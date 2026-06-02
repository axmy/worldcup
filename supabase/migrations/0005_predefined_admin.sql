-- ============================================================
-- Predefined admin + forced first-login password change
-- ============================================================
-- Every deployment ships with one organizer account. Its temp password must be
-- changed on first login (enforced in proxy.ts via this flag).
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- Seed the predefined admin: admin@kickoff.local / ChangeMe123!
-- Idempotent — skips creation if the email already exists. Token columns are set
-- to '' (empty), not NULL: GoTrue scans them into non-nullable strings and a NULL
-- there causes "Database error querying schema" at login.
do $$
declare
  v_id    uuid;
  v_email text := 'admin@kickoff.local';
  v_pw    text := 'ChangeMe123!';
begin
  select id into v_id from auth.users where email = v_email;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_email, extensions.crypt(v_pw, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', 'Organizer'), now(), now(),
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      v_id::text, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;

  -- handle_new_user() makes the profile on insert; ensure it exists either way,
  -- then mark it admin and require the password change.
  insert into public.profiles (id, display_name) values (v_id, 'Organizer')
    on conflict (id) do nothing;
  update public.profiles set is_admin = true, must_change_password = true where id = v_id;
end $$;
