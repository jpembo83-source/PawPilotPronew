-- ============================================================================
-- Phase 4 / Customers stage-1 REHEARSAL FIXTURE — synthetic KV data.
--
-- Seeds kv_store_fc003b23 with a representative customer:* key set for the
-- branch-DB rehearsal of 20260702093000_phase4_customers_backfill.sql.
-- Entirely synthetic (no production PII). Exercises, deliberately:
--   * plain and DOUBLE-JSON-ENCODED values (~25% of prod values are strings)
--   * both activity key variants (4-segment and 5-segment)
--   * every quarantine reason the migration can emit
--   * the non-canonical-tenant graph (quarantined per owner decision)
--   * TENANT-ALIAS records ('demo-tenant' and the ee4c3a1d-… uuid — owner
--     decision 2026-07-11): canonicalised to demo-tenant-001 and MIGRATED,
--     while the unrelated 'ee4c-fixture-tenant' graph still quarantines
--   * a dangling households.primary_contact_id (fixup + FK VALIDATE path)
--   * an activity whose household never migrated (soft FK — must still land)
--   * a duplicate blob id under two households (second key quarantined)
--
-- Expected outcome per family is pinned in customers-kv-fixture.expected.json;
-- the parity script asserts it with --expect.
--
-- NEVER run against prod: rehearsal branch databases only.
-- ============================================================================

insert into public.kv_store_fc003b23 (key, value) values

-- ---- households (kv 6 → migrate 3, quarantine 3) ---------------------------
('customer:demo-tenant-001:household:hh_fix_001', jsonb_build_object(
  'id','hh_fix_001','tenant_id','demo-tenant-001','name','Fixture Family One',
  'status','active','vip',true,'payment_hold',false,
  'primary_contact_id','con_fix_001','primary_location_id','loc_fix_1',
  'address',jsonb_build_object('line1','1 Test Way','city','Testville','postcode','TE5 7ST'),
  'internal_notes','fixture household #1','created_by','user_fix_1',
  'created_at','2026-06-01T08:00:00.000Z','updated_at','2026-06-02T09:30:00.000Z')),
-- double-encoded (value is a jsonb STRING containing the object), minimal
('customer:demo-tenant-001:household:hh_fix_002', to_jsonb(
  '{"id":"hh_fix_002","tenant_id":"demo-tenant-001","name":"Fixture Family Two","created_at":"2026-06-03T10:00:00.000Z","updated_at":"2026-06-03T10:00:00.000Z"}'::text)),
-- dangling primary_contact_id → migrates, pointer nulled + recorded in fixups
('customer:demo-tenant-001:household:hh_fix_003', jsonb_build_object(
  'id','hh_fix_003','tenant_id','demo-tenant-001','name','Fixture Family Three',
  'primary_contact_id','con_ghost_404',
  'created_at','2026-06-04T11:00:00.000Z','updated_at','2026-06-04T11:00:00.000Z')),
-- quarantine: invalid_created_at
('customer:demo-tenant-001:household:hh_fix_badts', jsonb_build_object(
  'id','hh_fix_badts','name','Fixture Bad Timestamp',
  'created_at','not-a-timestamp','updated_at','2026-06-04T11:00:00.000Z')),
-- quarantine: missing_name
('customer:demo-tenant-001:household:hh_fix_noname', jsonb_build_object(
  'id','hh_fix_noname',
  'created_at','2026-06-04T11:00:00.000Z','updated_at','2026-06-04T11:00:00.000Z')),
-- quarantine: non_canonical_tenant (owner-ratified 2026-07-02)
('customer:ee4c-fixture-tenant:household:hh_foreign_001', jsonb_build_object(
  'id','hh_foreign_001','tenant_id','ee4c-fixture-tenant','name','Foreign Tenant Family',
  'created_at','2026-06-05T12:00:00.000Z','updated_at','2026-06-05T12:00:00.000Z')),
-- TENANT ALIAS: 'demo-tenant' segment + alias blob tenant → migrates as demo-tenant-001
('customer:demo-tenant:household:hh_alias_001', jsonb_build_object(
  'id','hh_alias_001','tenant_id','demo-tenant','name','Alias Tenant Family',
  'created_at','2026-06-06T08:00:00.000Z','updated_at','2026-06-06T08:00:00.000Z')),

-- ---- contacts (kv 9 → migrate 4, quarantine 5) -----------------------------
('customer:demo-tenant-001:contact:hh_fix_001:con_fix_001', jsonb_build_object(
  'id','con_fix_001','tenant_id','demo-tenant-001','household_id','hh_fix_001',
  'first_name','Fixa','last_name','Tester','email','fixa@example.test',
  'phone','+44 7000 000001','preferred_contact_method','email',
  'is_primary',true,'is_emergency_contact',true,
  'emergency_contact_relationship','self','marketing_consent',true,
  'sms_consent',false,'email_consent',true,
  'created_at','2026-06-01T08:05:00.000Z','updated_at','2026-06-01T08:05:00.000Z')),
-- double-encoded secondary contact
('customer:demo-tenant-001:contact:hh_fix_001:con_fix_002', to_jsonb(
  '{"id":"con_fix_002","tenant_id":"demo-tenant-001","household_id":"hh_fix_001","first_name":"Secondo","last_name":"Tester","email":"secondo@example.test","is_primary":false,"created_at":"2026-06-01T08:10:00.000Z","updated_at":"2026-06-01T08:10:00.000Z"}'::text)),
('customer:demo-tenant-001:contact:hh_fix_002:con_fix_003', jsonb_build_object(
  'id','con_fix_003','household_id','hh_fix_002',
  'first_name','Tertia','last_name','Tester',
  'created_at','2026-06-03T10:05:00.000Z','updated_at','2026-06-03T10:05:00.000Z')),
-- quarantine: missing_household (household never existed)
('customer:demo-tenant-001:contact:hh_ghost_404:con_fix_004', jsonb_build_object(
  'id','con_fix_004','household_id','hh_ghost_404',
  'first_name','Ghost','last_name','Household',
  'created_at','2026-06-03T10:06:00.000Z','updated_at','2026-06-03T10:06:00.000Z')),
-- quarantine: missing_household (household itself quarantined — cascade)
('customer:demo-tenant-001:contact:hh_fix_noname:con_fix_005', jsonb_build_object(
  'id','con_fix_005','household_id','hh_fix_noname',
  'first_name','Casca','last_name','Ded',
  'created_at','2026-06-03T10:07:00.000Z','updated_at','2026-06-03T10:07:00.000Z')),
-- quarantine: household_key_mismatch (blob disagrees with key)
('customer:demo-tenant-001:contact:hh_fix_002:con_fix_006', jsonb_build_object(
  'id','con_fix_006','household_id','hh_fix_001',
  'first_name','Mis','last_name','Match',
  'created_at','2026-06-03T10:08:00.000Z','updated_at','2026-06-03T10:08:00.000Z')),
-- quarantine: non_canonical_tenant
('customer:ee4c-fixture-tenant:contact:hh_foreign_001:con_foreign_001', jsonb_build_object(
  'id','con_foreign_001','household_id','hh_foreign_001',
  'first_name','Foreign','last_name','Contact','is_primary',true,
  'created_at','2026-06-05T12:05:00.000Z','updated_at','2026-06-05T12:05:00.000Z')),
-- TENANT ALIAS: uuid alias segment, child of the alias household → migrates
('customer:ee4c3a1d-d391-44e6-b9bd-5f1aab2351b5:contact:hh_alias_001:con_alias_001', jsonb_build_object(
  'id','con_alias_001','household_id','hh_alias_001',
  'first_name','Alias','last_name','Primary','is_primary',true,
  'created_at','2026-06-06T08:05:00.000Z','updated_at','2026-06-06T08:05:00.000Z')),
-- duplicate blob id under two households: first key wins, second quarantined
('customer:demo-tenant-001:contact:hh_fix_001:con_dupid', jsonb_build_object(
  'id','con_dupid','household_id','hh_fix_001',
  'first_name','Dupla','last_name','Prima',
  'created_at','2026-06-06T09:00:00.000Z','updated_at','2026-06-06T09:00:00.000Z')),
('customer:demo-tenant-001:contact:hh_fix_002:con_dupid', jsonb_build_object(
  'id','con_dupid','household_id','hh_fix_002',
  'first_name','Dupla','last_name','Secunda',
  'created_at','2026-06-06T09:01:00.000Z','updated_at','2026-06-06T09:01:00.000Z')),

-- ---- pets (kv 6 → migrate 3, quarantine 3) ---------------------------------
('customer:demo-tenant-001:pet:hh_fix_001:pet_fix_001', jsonb_build_object(
  'id','pet_fix_001','tenant_id','demo-tenant-001','household_id','hh_fix_001',
  'photo_path','pet-photos/demo-tenant-001/pet_fix_001.jpg',
  'name','Rex','breed','Labrador','sex','male','date_of_birth','2020-05-01',
  'age_years',6.1,'microchip','985112345678903','weight_kg',22.5,
  'colour','black','address',jsonb_build_object('line1','1 Test Way'),
  'neutered_status','neutered','behaviour_notes','friendly',
  'medical_notes','none','feeding_instructions','twice daily',
  'allergies','none','vet_name','Fixture Vets','vet_phone','+44 7000 000009',
  'vet_address','9 Vet Street','vaccination_status','up_to_date',
  'vaccination_expiry_date','2026-12-31','daycare_enrolled',true,
  'grooming_enrolled',false,'transport_enrolled',false,
  'overnights_enrolled',false,'active',true,
  'created_at','2026-06-01T08:15:00.000Z','updated_at','2026-06-01T08:15:00.000Z')),
-- double-encoded, portal-added (owner_added + pending review)
('customer:demo-tenant-001:pet:hh_fix_001:pet_fix_002', to_jsonb(
  '{"id":"pet_fix_002","tenant_id":"demo-tenant-001","household_id":"hh_fix_001","name":"Bella","sex":"female","owner_added":true,"verification_status":"pending_staff_review","created_at":"2026-06-02T08:20:00.000Z","updated_at":"2026-06-02T08:20:00.000Z"}'::text)),
-- legacy bare-string address (contract union allows it)
('customer:demo-tenant-001:pet:hh_fix_002:pet_fix_003', jsonb_build_object(
  'id','pet_fix_003','household_id','hh_fix_002','name','Milo',
  'address','5 Kennel Lane',
  'created_at','2026-06-03T10:10:00.000Z','updated_at','2026-06-03T10:10:00.000Z')),
-- quarantine: missing_household
('customer:demo-tenant-001:pet:hh_ghost_404:pet_fix_004', jsonb_build_object(
  'id','pet_fix_004','household_id','hh_ghost_404','name','Ghosty',
  'created_at','2026-06-03T10:11:00.000Z','updated_at','2026-06-03T10:11:00.000Z')),
-- quarantine: invalid_numeric (weight not castable)
('customer:demo-tenant-001:pet:hh_fix_001:pet_fix_badnum', jsonb_build_object(
  'id','pet_fix_badnum','household_id','hh_fix_001','name','Heavy',
  'weight_kg','heavy',
  'created_at','2026-06-03T10:12:00.000Z','updated_at','2026-06-03T10:12:00.000Z')),
-- quarantine: non_canonical_tenant
('customer:ee4c-fixture-tenant:pet:hh_foreign_001:pet_foreign_001', jsonb_build_object(
  'id','pet_foreign_001','household_id','hh_foreign_001','name','Foreign Rex',
  'created_at','2026-06-05T12:10:00.000Z','updated_at','2026-06-05T12:10:00.000Z')),

-- ---- customer_documents (kv 5 → migrate 2, quarantine 3) -------------------
('customer:demo-tenant-001:document:hh_fix_001:doc_fix_001', jsonb_build_object(
  'id','doc_fix_001','tenant_id','demo-tenant-001','household_id','hh_fix_001',
  'pet_id','pet_fix_001','document_type','vaccination_certificate',
  'name','Rex vaccinations','file_name','rex-vaccs.pdf',
  'storage_path','#placeholder-rex-vaccs.pdf','file_size',2048,
  'mime_type','application/pdf','expiry_date','2026-11-30',
  'notes','fixture doc','uploaded_by','user_fix_1',
  'uploaded_at','2026-06-01T08:25:00.000Z')),
-- minimal → contract defaults (other / 0 / application/octet-stream)
('customer:demo-tenant-001:document:hh_fix_002:doc_fix_002', jsonb_build_object(
  'id','doc_fix_002','household_id','hh_fix_002',
  'uploaded_at','2026-06-03T10:15:00.000Z')),
-- quarantine: missing_pet
('customer:demo-tenant-001:document:hh_fix_001:doc_fix_003', jsonb_build_object(
  'id','doc_fix_003','household_id','hh_fix_001','pet_id','pet_ghost_404',
  'uploaded_at','2026-06-03T10:16:00.000Z')),
-- quarantine: invalid_uploaded_at (missing)
('customer:demo-tenant-001:document:hh_fix_001:doc_fix_004', jsonb_build_object(
  'id','doc_fix_004','household_id','hh_fix_001','name','No timestamp')),
-- quarantine: non_canonical_tenant
('customer:ee4c-fixture-tenant:document:hh_foreign_001:doc_foreign_001', jsonb_build_object(
  'id','doc_foreign_001','household_id','hh_foreign_001',
  'uploaded_at','2026-06-05T12:15:00.000Z')),

-- ---- household_notes (kv 5 → migrate 2, quarantine 3) ----------------------
-- created_by_name present in KV but dropped by the contract (drop-and-join)
('customer:demo-tenant-001:household:hh_fix_001:note:note_fix_001', jsonb_build_object(
  'id','note_fix_001','tenant_id','demo-tenant-001','household_id','hh_fix_001',
  'title','Behaviour observation','content','Settles quickly after drop-off.',
  'category','behaviour','visibility','internal','is_pinned',true,
  'created_by','user_fix_1','created_by_name','Fixture Staff',
  'created_at','2026-06-01T09:00:00.000Z','updated_at','2026-06-01T09:00:00.000Z')),
-- soft-deleted note (deleted_at kept, deleted_by dropped)
('customer:demo-tenant-001:household:hh_fix_001:note:note_fix_002', jsonb_build_object(
  'id','note_fix_002','household_id','hh_fix_001',
  'content','Outdated note.','category','general','visibility','customer',
  'created_by','user_fix_1','deleted_by','user_fix_2',
  'created_at','2026-06-01T09:05:00.000Z','updated_at','2026-06-02T09:05:00.000Z',
  'deleted_at','2026-06-02T09:05:00.000Z')),
-- quarantine: invalid_category
('customer:demo-tenant-001:household:hh_fix_002:note:note_fix_003', jsonb_build_object(
  'id','note_fix_003','household_id','hh_fix_002',
  'content','Category is not in the enum.','category','random',
  'created_at','2026-06-03T10:20:00.000Z','updated_at','2026-06-03T10:20:00.000Z')),
-- quarantine: missing_household
('customer:demo-tenant-001:household:hh_ghost_404:note:note_fix_004', jsonb_build_object(
  'id','note_fix_004','household_id','hh_ghost_404',
  'content','Household is gone.','category','general',
  'created_at','2026-06-03T10:21:00.000Z','updated_at','2026-06-03T10:21:00.000Z')),
-- quarantine: non_canonical_tenant
('customer:ee4c-fixture-tenant:household:hh_foreign_001:note:note_foreign_001', jsonb_build_object(
  'id','note_foreign_001','household_id','hh_foreign_001',
  'content','Foreign tenant note.','category','general',
  'created_at','2026-06-05T12:20:00.000Z','updated_at','2026-06-05T12:20:00.000Z')),

-- ---- household_flags (kv 5 → migrate 2, quarantine 3) ----------------------
('customer:demo-tenant-001:household:hh_fix_001:flag:flag_fix_001', jsonb_build_object(
  'id','flag_fix_001','tenant_id','demo-tenant-001','household_id','hh_fix_001',
  'flag_key','vip','severity','info','is_active',true,'reason','Long-standing customer',
  'created_by','user_fix_1','created_by_name','Fixture Staff',
  'created_at','2026-06-01T09:10:00.000Z','updated_at','2026-06-01T09:10:00.000Z')),
('customer:demo-tenant-001:household:hh_fix_001:flag:flag_fix_002', jsonb_build_object(
  'id','flag_fix_002','household_id','hh_fix_001','pet_id','pet_fix_001',
  'flag_key','behaviour_caution','severity','warn','is_active',true,
  'created_at','2026-06-01T09:15:00.000Z','updated_at','2026-06-01T09:15:00.000Z')),
-- quarantine: invalid_severity
('customer:demo-tenant-001:household:hh_fix_002:flag:flag_fix_003', jsonb_build_object(
  'id','flag_fix_003','household_id','hh_fix_002',
  'flag_key','medical_caution','severity','red',
  'created_at','2026-06-03T10:25:00.000Z','updated_at','2026-06-03T10:25:00.000Z')),
-- quarantine: missing_pet
('customer:demo-tenant-001:household:hh_fix_001:flag:flag_fix_004', jsonb_build_object(
  'id','flag_fix_004','household_id','hh_fix_001','pet_id','pet_ghost_404',
  'flag_key','grooming_restrictions','severity','info',
  'created_at','2026-06-03T10:26:00.000Z','updated_at','2026-06-03T10:26:00.000Z')),
-- quarantine: non_canonical_tenant
('customer:ee4c-fixture-tenant:household:hh_foreign_001:flag:flag_foreign_001', jsonb_build_object(
  'id','flag_foreign_001','household_id','hh_foreign_001',
  'flag_key','vip','severity','info',
  'created_at','2026-06-05T12:25:00.000Z','updated_at','2026-06-05T12:25:00.000Z')),

-- ---- note_pets links (kv 5 → migrate 1, quarantine 4) ----------------------
('customer:demo-tenant-001:note:note_fix_001:pet:pet_fix_001', jsonb_build_object(
  'tenant_id','demo-tenant-001','note_id','note_fix_001','pet_id','pet_fix_001')),
-- quarantine: missing_pet
('customer:demo-tenant-001:note:note_fix_001:pet:pet_ghost_404', jsonb_build_object(
  'tenant_id','demo-tenant-001','note_id','note_fix_001','pet_id','pet_ghost_404')),
-- quarantine: missing_note (never existed)
('customer:demo-tenant-001:note:note_ghost_404:pet:pet_fix_001', jsonb_build_object(
  'tenant_id','demo-tenant-001','note_id','note_ghost_404','pet_id','pet_fix_001')),
-- quarantine: missing_note (note quarantined — cascade)
('customer:demo-tenant-001:note:note_fix_003:pet:pet_fix_003', jsonb_build_object(
  'tenant_id','demo-tenant-001','note_id','note_fix_003','pet_id','pet_fix_003')),
-- quarantine: non_canonical_tenant
('customer:ee4c-fixture-tenant:note:note_foreign_001:pet:pet_foreign_001', jsonb_build_object(
  'tenant_id','ee4c-fixture-tenant','note_id','note_foreign_001','pet_id','pet_foreign_001')),

-- ---- customer_activities (kv 9 → migrate 4, quarantine 5) ------------------
-- 5-segment variant, minimal blob (the dominant prod shape: no tenant_id)
('customer:demo-tenant-001:activity:hh_fix_001:act_fix_001', jsonb_build_object(
  'id','act_fix_001','household_id','hh_fix_001',
  'activity_type','household_created','title','Household Created',
  'description','Household "Fixture Family One" was created',
  'occurred_at','2026-06-01T08:00:01.000Z','created_by','user_fix_1')),
-- 4-segment variant, full blob (metadata + created_at are dropped fields)
('customer:demo-tenant-001:activity:act_fix_002', jsonb_build_object(
  'id','act_fix_002','tenant_id','demo-tenant-001','household_id','hh_fix_001',
  'pet_id','pet_fix_001','activity_type','pet_updated',
  'title','Pet Profile Updated','description','Pet "Rex" profile was updated',
  'metadata',jsonb_build_object('flag_key','vip','severity','info'),
  'occurred_at','2026-06-02T08:30:00.000Z','created_by','user_fix_1',
  'created_by_name','Fixture Staff','created_at','2026-06-02T08:30:00.000Z')),
-- 5-segment, double-encoded
('customer:demo-tenant-001:activity:hh_fix_002:act_fix_003', to_jsonb(
  '{"id":"act_fix_003","household_id":"hh_fix_002","activity_type":"household_updated","title":"Household Updated","occurred_at":"2026-06-03T10:30:00.000Z","created_by":"user_fix_1"}'::text)),
-- soft FK: household never migrated, activity must still land
('customer:demo-tenant-001:activity:hh_ghost_404:act_fix_007', jsonb_build_object(
  'id','act_fix_007','household_id','hh_ghost_404',
  'activity_type','household_deleted','title','Household Deleted',
  'occurred_at','2026-06-04T10:00:00.000Z','created_by','user_fix_1')),
-- quarantine: missing_household_id (4-segment blob without household)
('customer:demo-tenant-001:activity:act_fix_004', jsonb_build_object(
  'id','act_fix_004','activity_type','contact_added','title','Contact Added',
  'occurred_at','2026-06-03T10:31:00.000Z')),
-- quarantine: household_key_mismatch (blob disagrees with 5-segment key)
('customer:demo-tenant-001:activity:hh_fix_001:act_fix_005', jsonb_build_object(
  'id','act_fix_005','household_id','hh_fix_002',
  'activity_type','pet_added','title','Pet Added',
  'occurred_at','2026-06-03T10:32:00.000Z')),
-- quarantine: invalid_occurred_at
('customer:demo-tenant-001:activity:hh_fix_001:act_fix_006', jsonb_build_object(
  'id','act_fix_006','household_id','hh_fix_001',
  'activity_type','pet_added','title','Pet Added','occurred_at','yesterday')),
-- quarantine: non_canonical_tenant (both variants)
('customer:ee4c-fixture-tenant:activity:act_foreign_001', jsonb_build_object(
  'id','act_foreign_001','household_id','hh_foreign_001',
  'activity_type','household_created','title','Household Created',
  'occurred_at','2026-06-05T12:30:00.000Z')),
('customer:ee4c-fixture-tenant:activity:hh_foreign_001:act_foreign_002', jsonb_build_object(
  'id','act_foreign_002','household_id','hh_foreign_001',
  'activity_type','household_updated','title','Household Updated',
  'occurred_at','2026-06-05T12:31:00.000Z')),

-- ---- unclassified customer:* keys (2 → catch-all quarantine) ---------------
('customer:demo-tenant-001:weird:w1', jsonb_build_object('anything','goes')),
('customer:demo-tenant-001:household:hh_fix_001:note:note_fix_001:extra',
  jsonb_build_object('seven','segments'))

on conflict (key) do update set value = excluded.value;
