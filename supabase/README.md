# Supabase para VITAMATE

Las migraciones contienen el esquema, RLS, buckets y catálogo base de ejercicios.

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

No uses las claves publicadas en conversaciones. Rota primero la clave de servicio y configura los valores nuevos únicamente en el entorno del backend.

Para desarrollo local:

```bash
supabase start
supabase db reset
```

Los activos de `exercise-guides` son globales y solo el backend con service role puede crearlos. `meal-photos` es privado y queda aislado por carpeta de usuario mediante RLS.
