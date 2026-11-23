-- Certification : vidéo selfie silencieuse (5 à 10 s) examinée par l'équipe, puis supprimée dès la décision.
-- + logos de communauté (bucket public en lecture, écriture limitée au dossier de son propriétaire).

-- 1) Mode « video » : toute demande passe par un examen humain (vidéo + preuve), jamais de badge automatique.
insert into public.app_settings (key, value) values ('certification_presence_mode', '"video"')
on conflict (key) do update set value = '"video"';

create or replace function public.cert_presence_ok(p_verification_id uuid)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select case coalesce((select value #>> '{}' from app_settings where key = 'certification_presence_mode'), 'provider')
    when 'off' then true
    -- La vidéo doit avoir été envoyée ; l'administrateur la visionne avant d'approuver (cf. admin_review_certification).
    when 'video' then coalesce((select evidence ? 'video_path' or (presence_status = 'passed' and presence_expires_at > now())
                                  from creator_verifications where id = p_verification_id), false)
    else coalesce((select presence_status = 'passed' and presence_expires_at > now() from creator_verifications where id = p_verification_id), false)
  end;
$$;

-- 2) En mode « video », la méthode est toujours manuelle (examen humain) : pas de validation automatique.
create or replace function public.cert_force_manual()
returns trigger language plpgsql as $$
begin
  if coalesce((select value #>> '{}' from public.app_settings where key = 'certification_presence_mode'), '') = 'video'
     and new.method in ('auto_domain', 'auto_youtube', 'auto_twitch') then
    new.method := 'manual_social';
  end if;
  return new;
end $$;
drop trigger if exists cert_force_manual_trg on public.creator_verifications;
create trigger cert_force_manual_trg before insert on public.creator_verifications for each row execute function public.cert_force_manual();

-- 3) Rattache la vidéo envoyée (dossier = identifiant de l'utilisateur) à la demande en cours.
create or replace function public.attach_presence_video(p_verification_id uuid, p_path text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_row creator_verifications;
begin
  select v.* into v_row from creator_verifications v join creator_profiles c on c.id = v.creator_id
   where v.id = p_verification_id and c.owner_user_id = public.require_user() for update of v;
  if v_row.id is null then raise exception 'verification_not_found' using errcode = 'P0002'; end if;
  if v_row.status <> 'awaiting_proof' then raise exception 'verification_not_open' using errcode = '22023'; end if;
  if p_path is null or p_path !~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]{1,80}$') then raise exception 'invalid_path' using errcode = '22023'; end if;
  update creator_verifications set evidence = evidence || jsonb_build_object('video_path', p_path, 'video_at', now()) where id = v_row.id;
  perform public.cert_event(v_row.creator_id, v_row.id, 'presence_video_submitted');
end $$;

-- L'administrateur efface la référence une fois la vidéo supprimée du stockage.
create or replace function public.admin_clear_presence_video(p_verification_id uuid)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.require_admin();
  update creator_verifications set evidence = evidence - 'video_path' where id = p_verification_id;
end $$;

revoke execute on function public.attach_presence_video(uuid, text), public.admin_clear_presence_video(uuid), public.cert_force_manual() from public, anon;
grant execute on function public.attach_presence_video(uuid, text), public.admin_clear_presence_video(uuid) to authenticated;

-- 4) Logos : l'adresse ne peut pointer que vers le stockage public « avatars ».
create or replace function public.check_avatar_url()
returns trigger language plpgsql as $$
begin
  if new.avatar_url is not null and new.avatar_url !~ '^https://[^/]+/storage/v1/object/public/avatars/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$' then
    raise exception 'invalid_avatar_url' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists check_avatar_url_trg on public.creator_profiles;
create trigger check_avatar_url_trg before insert or update of avatar_url on public.creator_profiles for each row execute function public.check_avatar_url();

-- 5) Stockage (absent des bases de test locales : bloc conditionnel).
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
    ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
    ('cert-videos', 'cert-videos', false, 31457280, array['video/mp4', 'video/quicktime'])
  on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  drop policy if exists avatars_own_write on storage.objects;
  create policy avatars_own_write on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  drop policy if exists avatars_own_update on storage.objects;
  create policy avatars_own_update on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
  drop policy if exists avatars_own_delete on storage.objects;
  create policy avatars_own_delete on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

  -- Vidéos : le créateur ne peut qu'envoyer dans son dossier ; seuls les administrateurs peuvent lire et supprimer.
  drop policy if exists certvid_own_write on storage.objects;
  create policy certvid_own_write on storage.objects for insert to authenticated
    with check (bucket_id = 'cert-videos' and (storage.foldername(name))[1] = auth.uid()::text);
  drop policy if exists certvid_admin_read on storage.objects;
  create policy certvid_admin_read on storage.objects for select to authenticated
    using (bucket_id = 'cert-videos' and public.is_admin());
  drop policy if exists certvid_admin_delete on storage.objects;
  create policy certvid_admin_delete on storage.objects for delete to authenticated
    using (bucket_id = 'cert-videos' and public.is_admin());
end $$;

-- Préfixe des codes : SMC- (maquette).
create or replace function public.cert_alphabet_code()
returns text language plpgsql volatile as $$
declare
  v_chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   -- sans 0/O/1/I/L : lisible et recopiable
  v_bytes bytea := extensions.gen_random_bytes(8);
  v_out text := '';
begin
  for i in 0..7 loop
    v_out := v_out || substr(v_chars, (get_byte(v_bytes, i) % 31) + 1, 1);
  end loop;
  return 'SMC-' || substr(v_out, 1, 4) || '-' || substr(v_out, 5, 4);
end $$;
