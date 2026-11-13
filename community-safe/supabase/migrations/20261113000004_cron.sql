-- Planification du worker d'envoi (toutes les minutes) : reprises sur erreur et reçus.
-- Nécessite pg_cron + pg_net (activés par défaut sur Supabase) et deux secrets Vault :
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/dispatch-alerts', 'dispatch_url');
--   select vault.create_secret('<DISPATCH_SECRET>', 'dispatch_secret');
-- Sans ces secrets, le job tourne à vide et les alertes partent uniquement à l'appel de l'app.
do $outer$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron')
     or not exists (select 1 from pg_available_extensions where name = 'pg_net') then
    raise notice 'pg_cron/pg_net indisponibles : planification ignorée';
    return;
  end if;
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
  perform cron.schedule('dispatch-alerts', '* * * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'dispatch_url'),
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-dispatch-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'dispatch_secret')),
      body := '{}'::jsonb)
    where exists (select 1 from vault.decrypted_secrets where name = 'dispatch_url');
  $job$);
end $outer$;
