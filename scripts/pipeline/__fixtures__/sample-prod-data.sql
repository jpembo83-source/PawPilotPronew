--
-- PostgreSQL database dump (synthetic fixture — NOT real data)
--
SET session_replication_role = replica;

COPY public.households (id, tenant_id, name, status, hold_reason, hold_notes, internal_notes, address, created_at) FROM stdin;
h1	t1	The Real Smiths	active	overdue invoice	call before 9am	VIP, complains a lot	{"line1": "12 Real St", "city": "London", "postcode": "N1 1AA"}	2026-01-01 00:00:00+00
\.

COPY public.contacts (id, tenant_id, household_id, first_name, last_name, email, phone, email_consent) FROM stdin;
c1	t1	h1	Jane	Smith	jane.smith@gmail.com	+447700900123	t
c2	t1	h1	Bob	Jones	\N	\N	f
\.

COPY public.pets (id, tenant_id, household_id, name, photo_url, microchip, address, behaviour_notes, medical_notes, feeding_instructions, allergies, vet_name, vet_phone, vet_address) FROM stdin;
p1	t1	h1	Rex	https://x/storage/jane-rex.jpg	981000000123456	\N	bites strangers	epilepsy meds 2x\ndaily	one cup am	peanuts	Dr Real Vet	+447700900999	5 Vet Road
\.

COPY public.household_notes (id, tenant_id, household_id, title, content, created_at) FROM stdin;
n1	t1	h1	Gate code	Door code is 4821, key under mat	2026-01-02 00:00:00+00
\.

COPY public.note_pets (note_id, pet_id) FROM stdin;
n1	p1
\.

COPY public.customer_activities (id, tenant_id, household_id, activity_type, title, description, created_by_name) FROM stdin;
a1	t1	h1	call	Called Jane Smith	Discussed overdue balance of 240	Alice Operator
\.

COPY public.kv_store_fc003b23 (key, value, created_at) FROM stdin;
customer:household:h1	{"ownerName": "Jane Smith", "contact": {"email": "jane.smith@gmail.com", "phone": "+447700900123"}, "pets": [{"petName": "Rex", "medicalNotes": "epilepsy", "vetName": "Dr Real"}], "address": {"line1": "12 Real St", "postcode": "N1 1AA"}, "balance": 240}	2026-01-01 00:00:00+00
portal_user:jane.smith@gmail.com	{"displayName": "Jane S", "flags": ["vip"]}	2026-01-01 00:00:00+00
\.

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
4326	EPSG	4326	GEOGCS	+proj=longlat
\.

SET session_replication_role = origin;
