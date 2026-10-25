
-- 不要なレベル別ニックネームを整理する。
-- 火炎入道2〜99、キグニ族2〜99を削除。
-- ンドゥバは年齢ごとの「○才」を削除し、
-- はたち / みそじ / かんれき / こき / きじゅ / べいじゅ / そつじゅ / はくじゅ は残す。

do $$
declare
  v_profile record;
  v_new_nickname_id bigint;
begin
  for v_profile in
    select pp.user_id, pp.nickname_id
    from public.player_profiles pp
    join public.nickname_pool np
      on np.id = pp.nickname_id
    where
      np.name ~ '^火炎入道[0-9]+$'
      or np.name ~ '^キグニ族[0-9]+$'
      or np.name ~ '^ンドゥバ[0-9]+才$'
  loop
    select np.id
    into v_new_nickname_id
    from public.nickname_pool np
    where np.is_active = true
      and not (
        np.name ~ '^火炎入道[0-9]+$'
        or np.name ~ '^キグニ族[0-9]+$'
        or np.name ~ '^ンドゥバ[0-9]+才$'
      )
      and not exists (
        select 1
        from public.player_profiles existing_profile
        where existing_profile.nickname_id = np.id
      )
    order by random()
    limit 1
    for update skip locked;

    if v_new_nickname_id is null then
      raise exception 'no unused nickname available for reassignment';
    end if;

    update public.player_profiles
    set nickname_id = v_new_nickname_id
    where user_id = v_profile.user_id;
  end loop;
end;
$$;

delete from public.nickname_pool
where
  name ~ '^火炎入道[0-9]+$'
  or name ~ '^キグニ族[0-9]+$'
  or name ~ '^ンドゥバ[0-9]+才$';

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.nickname_pool
  where is_active = true;

  if v_count <> 568 then
    raise exception 'unexpected nickname count after cleanup: % (expected 568)', v_count;
  end if;
end;
$$;
