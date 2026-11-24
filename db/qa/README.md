# Casos de prueba de QA (hoja VIAJE)

Por el reparo del cliente al RF-16 (10/11/2026), **la lista Viaje se inicializa vacía en
producción**. La hoja VIAJE de `MODELO_DATOS_MUESTRAS_2.xlsx` se usa **solo** en el ambiente de
calidad (QA) como conjunto de casos de aceptación.

## Procedimiento

1. Coloque la planilla en `db/qa/MODELO_DATOS_MUESTRAS_2.xlsx` (no se versiona; ver `.gitignore`).
2. Importe los maestros en QA desde la Web (CU-05). La hoja VIAJE se ignora automáticamente.
3. Ejecute la reproducción de marcaciones contra la API de QA:

   ```bash
   API_URL=https://api-qa.example/v1 QA_TOKEN_<RUT>=<jwt> \
     pnpm --filter @gm/api exec node --import @swc-node/register/esm-register \
       scripts/reproducir-viajes-qa.ts ../../db/qa/MODELO_DATOS_MUESTRAS_2.xlsx
   ```

   El script se niega a ejecutarse si `API_URL` apunta a producción.

   El script envía cada fila de VIAJE como `POST /v1/marcaciones` (origen `SIN_CONEXION`, con la
   hora original), de modo que la API recalcule estado, comuna y fuera de ruta con las reglas
   vigentes, y compara el resultado con los valores de la planilla.

4. Revise el informe de diferencias. Diferencias esperadas y documentadas:
   - **HAL-17:** el error de las 11:15:25 informa «LA FLORIDA»; la API asigna la comuna del
     límite oficial que contiene el punto.

5. Verifique el dashboard del 30/09/2026: 15 · 6 · 5 · 1 · 40,0 % · 6,7 % · 2 fuera de ruta.
