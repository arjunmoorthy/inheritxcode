#!/bin/bash
# =============================================================================
# Fix Patient API Task Definition - Add Doctor DB Secrets
# =============================================================================
#
# This script fixes the Patient API task definition by adding the missing
# Doctor DB connection secrets required for the login endpoint.
#
# Issue: The login endpoint queries the DoctorUser table but the task
#        definition was missing DOCTOR_DB_HOST, DOCTOR_DB_PASSWORD,
#        DOCTOR_DB_USER, and DOCTOR_DB_NAME secrets.
#
# Usage: ./scripts/aws/fix-patient-api-task-def.sh
#
# Prerequisites:
#   - AWS CLI configured
#   - Appropriate IAM permissions to update ECS task definitions
#
# =============================================================================

set -e

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
PROJECT_NAME="oncolife"
ENVIRONMENT="production"
ECS_CLUSTER="${PROJECT_NAME}-${ENVIRONMENT}"
PATIENT_API_SERVICE="patient-api-service"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ -z "$ACCOUNT_ID" ]; then
    log_error "Failed to get AWS account ID. Check your AWS credentials."
    exit 1
fi

log_info "AWS Account: $ACCOUNT_ID"
log_info "Region: $AWS_REGION"
log_info "Cluster: $ECS_CLUSTER"

# Get the DB secret ARN
log_step "Finding Secrets Manager secret..."
DB_SECRET_ARN=$(aws secretsmanager describe-secret \
    --secret-id "${PROJECT_NAME}/db" \
    --region $AWS_REGION \
    --query 'ARN' \
    --output text 2>/dev/null)

if [ -z "$DB_SECRET_ARN" ] || [ "$DB_SECRET_ARN" = "None" ]; then
    log_error "Could not find secret '${PROJECT_NAME}/db'. Please run full-deploy.sh first."
    exit 1
fi

log_success "Found DB Secret: $DB_SECRET_ARN"

# Get the Cognito secret ARN
log_step "Finding Cognito secret..."
COGNITO_SECRET_ARN=$(aws secretsmanager describe-secret \
    --secret-id "${PROJECT_NAME}/cognito" \
    --region $AWS_REGION \
    --query 'ARN' \
    --output text 2>/dev/null)

if [ -z "$COGNITO_SECRET_ARN" ] || [ "$COGNITO_SECRET_ARN" = "None" ]; then
    log_error "Could not find secret '${PROJECT_NAME}/cognito'. Please run full-deploy.sh first."
    exit 1
fi

log_success "Found Cognito Secret: $COGNITO_SECRET_ARN"

# Create the updated task definition
log_step "Creating updated Patient API task definition..."

cat > ./patient-task-def-fixed.json <<EOFPATIENT
{
    "family": "$PROJECT_NAME-patient-api",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "512",
    "memory": "1024",
    "executionRoleArn": "arn:aws:iam::$ACCOUNT_ID:role/ecsTaskExecutionRole",
    "taskRoleArn": "arn:aws:iam::$ACCOUNT_ID:role/${PROJECT_NAME}TaskRole",
    "containerDefinitions": [
        {
            "name": "patient-api",
            "image": "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME-patient-api:latest",
            "portMappings": [{"containerPort": 8000, "protocol": "tcp"}],
            "essential": true,
            "environment": [
                {"name": "ENVIRONMENT", "value": "$ENVIRONMENT"},
                {"name": "DEBUG", "value": "false"},
                {"name": "LOG_LEVEL", "value": "INFO"},
                {"name": "AWS_REGION", "value": "$AWS_REGION"},
                {"name": "S3_EDUCATION_BUCKET", "value": "$PROJECT_NAME-education-$ACCOUNT_ID"},
                {"name": "S3_REFERRAL_BUCKET", "value": "$PROJECT_NAME-referrals-$ACCOUNT_ID"},
                {"name": "LOCAL_DEV_MODE", "value": "false"}
            ],
            "secrets": [
                {"name": "PATIENT_DB_HOST", "valueFrom": "$DB_SECRET_ARN:host::"},
                {"name": "PATIENT_DB_PASSWORD", "valueFrom": "$DB_SECRET_ARN:password::"},
                {"name": "PATIENT_DB_USER", "valueFrom": "$DB_SECRET_ARN:username::"},
                {"name": "PATIENT_DB_NAME", "valueFrom": "$DB_SECRET_ARN:patient_db::"},
                {"name": "DOCTOR_DB_HOST", "valueFrom": "$DB_SECRET_ARN:host::"},
                {"name": "DOCTOR_DB_PASSWORD", "valueFrom": "$DB_SECRET_ARN:password::"},
                {"name": "DOCTOR_DB_USER", "valueFrom": "$DB_SECRET_ARN:username::"},
                {"name": "DOCTOR_DB_NAME", "valueFrom": "$DB_SECRET_ARN:doctor_db::"},
                {"name": "COGNITO_USER_POOL_ID", "valueFrom": "$COGNITO_SECRET_ARN:user_pool_id::"},
                {"name": "COGNITO_CLIENT_ID", "valueFrom": "$COGNITO_SECRET_ARN:client_id::"}
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/$PROJECT_NAME-patient-api",
                    "awslogs-region": "$AWS_REGION",
                    "awslogs-stream-prefix": "ecs"
                }
            },
            "healthCheck": {
                "command": ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"],
                "interval": 30,
                "timeout": 5,
                "retries": 3,
                "startPeriod": 60
            }
        }
    ]
}
EOFPATIENT

log_success "Task definition JSON created"

# Register the new task definition
log_step "Registering new task definition..."
NEW_TASK_DEF_ARN=$(aws ecs register-task-definition \
    --cli-input-json file://patient-task-def-fixed.json \
    --region $AWS_REGION \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

rm -f ./patient-task-def-fixed.json

if [ -z "$NEW_TASK_DEF_ARN" ] || [ "$NEW_TASK_DEF_ARN" = "None" ]; then
    log_error "Failed to register task definition"
    exit 1
fi

log_success "Task definition registered: $NEW_TASK_DEF_ARN"

# Update the ECS service to use the new task definition
log_step "Updating Patient API service with new task definition..."
aws ecs update-service \
    --cluster $ECS_CLUSTER \
    --service $PATIENT_API_SERVICE \
    --task-definition "$NEW_TASK_DEF_ARN" \
    --force-new-deployment \
    --region $AWS_REGION > /dev/null

log_success "Service updated successfully"

# Wait for deployment to complete
log_step "Waiting for deployment to complete (this may take 2-5 minutes)..."

attempts=0
max_attempts=30

while [ $attempts -lt $max_attempts ]; do
    SERVICE_STATUS=$(aws ecs describe-services \
        --cluster $ECS_CLUSTER \
        --services $PATIENT_API_SERVICE \
        --region $AWS_REGION \
        --query 'services[0].deployments[0].status' \
        --output text 2>/dev/null)
    
    RUNNING_COUNT=$(aws ecs describe-services \
        --cluster $ECS_CLUSTER \
        --services $PATIENT_API_SERVICE \
        --region $AWS_REGION \
        --query 'services[0].runningCount' \
        --output text 2>/dev/null)
    
    log_info "Status: $SERVICE_STATUS | Running tasks: $RUNNING_COUNT"
    
    if [ "$SERVICE_STATUS" = "PRIMARY" ] && [ "$RUNNING_COUNT" -ge 1 ] 2>/dev/null; then
        log_success "Deployment complete!"
        break
    fi
    
    attempts=$((attempts + 1))
    sleep 10
done

if [ $attempts -ge $max_attempts ]; then
    log_warning "Deployment may still be in progress. Check ECS console for status."
fi

# Test health endpoint
log_step "Testing Patient API health endpoint..."
sleep 10  # Give tasks time to start

PATIENT_ALB_DNS=$(aws elbv2 describe-load-balancers \
    --names "${PROJECT_NAME}-patient-alb" \
    --region $AWS_REGION \
    --query 'LoadBalancers[0].DNSName' \
    --output text 2>/dev/null)

if [ -n "$PATIENT_ALB_DNS" ] && [ "$PATIENT_ALB_DNS" != "None" ]; then
    if command -v curl &> /dev/null; then
        HEALTH_RESPONSE=$(curl -sf "http://$PATIENT_ALB_DNS/health" 2>/dev/null || echo "")
        if [ -n "$HEALTH_RESPONSE" ]; then
            log_success "Patient API is healthy: $HEALTH_RESPONSE"
        else
            log_warning "Health check not responding yet (tasks may still be starting)"
        fi
    fi
fi

echo ""
log_success "+==========================================+"
log_success "|  Patient API Task Definition Fixed!     |"
log_success "+==========================================+"
echo ""
log_info "The following secrets have been added:"
echo "  - DOCTOR_DB_HOST"
echo "  - DOCTOR_DB_PASSWORD"
echo "  - DOCTOR_DB_USER"
echo "  - DOCTOR_DB_NAME"
echo ""
log_info "The login endpoint should now work correctly."
echo ""
