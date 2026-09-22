-- Copy visible de los logros con acentos y ñ (el seed de 0002 se escribio en ASCII).
-- Solo datos: sin tablas nuevas, sin cambios de RLS.
update public.achievements set name = 'Un año de forja' where id = 'sesiones_365';
update public.achievements set name = 'Medio millón' where id = 'volumen_500k';
update public.achievements set name = 'Trimestre sólido' where id = 'racha_12';
update public.achievements set name = 'Medio año' where id = 'racha_26';
update public.achievements set name = 'Año inquebrantable' where id = 'racha_52';
update public.achievements set description = 'Rompe tu primer récord personal' where id = 'primer_pr';
update public.achievements set description = 'Rompe 25 récords personales' where id = 'prs_25';
