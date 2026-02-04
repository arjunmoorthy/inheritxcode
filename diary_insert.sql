-- DIARY ENTRIES
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (1, '2026-01-12 12:53:07.317248', '2026-01-12 12:53:07.317248', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-12 12:53
Symptoms: SWE-214
Assessment Level: Notify Care Team

Triage Results:
- Swelling: Notify Care Team
', '66a708dd-8297-4291-9b8b-d880acee3d36', f, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (2, '2026-01-12 13:02:45.258434', '2026-01-12 13:02:45.258434', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-12 13:02
Symptoms: URG-108
Assessment Level: None
', '03d5815d-86c8-400f-b4fc-03fea99ddc9e', f, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (3, '2026-01-12 13:48:11.368896', '2026-01-12 13:48:11.368896', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-12 13:48
Symptoms: MSO-208, URG-114
Assessment Level: None
', '06354d13-3e83-4454-851d-4be797e15582', f, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (4, '2026-01-12 19:36:29.936657', '2026-01-12 19:36:29.936657', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-12 19:36
Symptoms: Swelling
Assessment Level: Notify Care Team

Triage Results:
- Swelling: Notify Care Team
', 'faba1edc-d72a-4e9b-b382-4fe6cf4352b6', t, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (5, '2026-01-13 18:37:34.583181', '2026-01-13 18:37:34.583181', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-13 18:37
Symptoms: Eye Complaints
Assessment Level: Notify Care Team

Triage Results:
- Eye Complaints: Notify Care Team
', '1c8fdccb-eb6e-4f76-b9a0-fb9bd535ff68', t, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (6, '2026-01-13 18:59:26.939471', '2026-01-13 18:59:26.939471', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-13 18:59
Symptoms: Bleeding / Bruising
Assessment Level: Call 911

Triage Results:
- Bleeding / Bruising: Call 911
', '583af591-bbf2-4b1c-877e-61119dcbffa5', t, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (7, '2026-01-14 03:39:44.921766', '2026-01-14 03:39:44.921766', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-14 03:39
Symptoms: Eye Complaints
Assessment Level: None
', '1cf00cdc-c61c-4314-ac21-e479179fb0b9', f, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (8, '2026-01-14 03:39:51.380373', '2026-01-14 03:39:51.380373', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-14 03:39
Symptoms: Eye Complaints
Assessment Level: None
', 'aef0d0c0-7c3c-4936-a875-02473db66775', f, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (9, '2026-01-14 03:45:08.081773', '2026-01-14 03:45:08.081773', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-14 03:45
Symptoms: Fainting / Syncope
Assessment Level: Call 911

Triage Results:
- Fainting / Syncope: Call 911
', '1c59175d-c0b5-4539-b4c7-f433ab84504e', t, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (10, '2026-01-14 03:45:10.995222', '2026-01-14 03:45:10.995222', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-14 03:45
Symptoms: Fainting / Syncope
Assessment Level: Call 911

Triage Results:
- Fainting / Syncope: Call 911
', 'e2ef7993-05e3-4803-904a-7c7b77e614da', t, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (11, '2026-01-14 16:42:02.630409', '2026-01-14 16:42:02.630409', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-14 16:42
Symptoms: Eye Complaints
Assessment Level: Notify Care Team

Triage Results:
- Eye Complaints: Notify Care Team
', '946d8aee-dc83-4f91-b23c-3ac9abc561d4', t, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (12, '2026-01-14 18:14:04.593798', '2026-01-14 18:14:04.593798', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-14 18:14
Symptoms: Swelling
Assessment Level: Notify Care Team

Triage Results:
- Swelling: Notify Care Team
', '9f40a601-edd5-4119-b56d-f34dd2a21bd4', t, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (13, '2026-01-14 18:14:32.934026', '2026-01-14 18:14:32.934026', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-14 18:14
Symptoms: Swelling
Assessment Level: None

Triage Results:
- Swelling: Notify Care Team
', '6ae36934-053b-4158-8415-912f6827f3a1', f, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (14, '2026-01-15 06:41:11.413416', '2026-01-15 06:41:11.413416', '11111111-1111-1111-1111-111111111111', 'Test', 'Test entry', '4709f072-2afa-48ac-b645-2124fd73d701', f, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (15, '2026-01-15 06:58:17.622928', '2026-01-15 06:58:17.622928', '11111111-1111-1111-1111-111111111111', 'Test after fix', 'Test entry from fix', '906a5c79-3927-4449-b560-1e79a9a43af2', t, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (16, '2026-01-15 07:04:38.124058', '2026-01-15 07:04:38.124058', '11111111-1111-1111-1111-111111111111', 'January 15, 2026', 'text', 'ba23a305-d2f9-4217-97a8-2928ddd7d51d', f, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (17, '2026-01-15 07:05:12.486882', '2026-01-15 07:05:12.486882', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-15 07:05
Symptoms: Eye Complaints
Assessment Level: None
', 'f8c74358-66e9-486a-9d63-62a904eea27e', f, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (18, '2026-01-15 07:08:15.847531', '2026-01-15 07:08:15.847531', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-15 07:08
Symptoms: Altered Mental Status
Assessment Level: Call 911

Triage Results:
- Altered Mental Status: Call 911
', 'd6693057-874d-4fcd-8b34-ed7bb70f4650', t, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (19, '2026-01-15 07:08:30.681731', '2026-01-15 07:08:30.681731', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-15 07:08
Symptoms: Altered Mental Status
Assessment Level: Call 911

Triage Results:
- Altered Mental Status: Call 911
', '43f2989e-6a1e-4870-8fb9-1a45331a9847', t, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (20, '2026-01-17 04:53:50.751695', '2026-01-17 04:53:50.751695', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-17 04:53
Symptoms: Eye Complaints
Assessment Level: None
', '52aaf4f7-e5e8-4f89-b730-c4c76caa431d', f, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (21, '2026-01-17 04:54:13.69179', '2026-01-17 04:54:13.69179', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-17 04:54
Symptoms: Eye Complaints
Assessment Level: None
', 'ac41428c-c05b-4b07-9d4e-4d8697fd2df1', f, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (22, '2026-01-17 04:54:18.596225', '2026-01-17 04:54:18.596225', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-17 04:54
Symptoms: Eye Complaints
Assessment Level: None
', '904a3f29-dbb4-4c50-8633-dafe69b767ac', f, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (23, '2026-01-17 04:55:26.207035', '2026-01-17 04:55:26.207035', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-17 04:55
Symptoms: Eye Complaints
Assessment Level: None
', '1083361f-9d2c-4a3b-ad19-87a9e86bdac6', f, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (24, '2026-01-17 05:12:55.900777', '2026-01-17 05:12:55.900777', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-17 05:12
Symptoms: Altered Mental Status
Assessment Level: Call 911

Triage Results:
- Altered Mental Status: Call 911
', '76377340-575a-4c7e-b563-e31a198f0e17', t, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (25, '2026-01-17 05:12:58.486663', '2026-01-17 05:12:58.486663', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-17 05:12
Symptoms: Altered Mental Status
Assessment Level: Call 911

Triage Results:
- Altered Mental Status: Call 911
', '04cd6c24-b4a3-46a0-99d2-d33c50ded588', t, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (26, '2026-01-17 05:14:01.490712', '2026-01-17 05:14:01.490712', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-17 05:14
Symptoms: Skin Rash / Redness
Assessment Level: Notify Care Team

Triage Results:
- Skin Rash / Redness: Notify Care Team
', '1763f3b2-2c82-447c-ae70-78dc64f8e811', t, f) ON CONFLICT DO NOTHING;
INSERT INTO patient_diary_entries (id, created_at, last_updated_at, patient_uuid, title, diary_entry, entry_uuid, marked_for_doctor, is_deleted) VALUES (27, '2026-01-17 05:14:31.355442', '2026-01-17 05:14:31.355442', '11111111-1111-1111-1111-111111111111', NULL, 'Symptom Check Summary
Date: 2026-01-17 05:14
Symptoms: Skin Rash / Redness
Assessment Level: None

Triage Results:
- Skin Rash / Redness: Notify Care Team
', '918defed-0016-464c-822c-167f2fd26147', f, f) ON CONFLICT DO NOTHING;
