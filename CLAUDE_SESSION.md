# Investor Analyst Terminal - Session Context

## Estado del Proyecto: MVP en Testing

### Última sesión: 2026-02-01

**Lo que se hizo:**
1. Creado `docker-compose.yml` (no existía)
2. PostgreSQL corriendo en puerto **5434** (5432 y 5433 estaban ocupados)
3. Base de datos sincronizada con Prisma
4. Arreglado botón de refresh en CompanyHeader (usaba router.push en vez de fetch)
5. Arreglado error de serialización Decimal → number para Client Components
6. Mejorado mapeo XBRL para Revenue (filtro por fecha de período + más tags)

**Bugs corregidos:**
- `company-header.tsx`: Botón refresh ahora usa fetch con credentials
- `page.tsx` (company): Agregada función `serialize()` para convertir Decimal/BigInt
- `xbrl-mapper.ts`: Filtro para seleccionar valor correcto por año fiscal

---

## Comandos para iniciar:

```bash
cd ~/investor-analyst-terminal
docker-compose up -d
npm run dev
```

Abrir: http://localhost:3000

---

## Pendiente por probar:

1. **Refresh de AAPL** - Click en botón refresh para verificar que Revenue ahora se muestra
2. **Verificar Financials** - Income Statement debe mostrar Revenue en todos los años
3. **Verificar Metrics** - Debe mostrar datos de 2019-2025, no solo 2018
4. **Generar Recommendations** - Después de tener financials completos

---

## Arquitectura implementada:

**Infraestructura:**
- Docker Compose para PostgreSQL (puerto 5434)
- Prisma schema con 13 modelos
- Autenticación JWT + bcrypt

**Proveedores de datos:**
- SEC EDGAR para financials (`src/lib/providers/sec/`)
- Stooq para precios (`src/lib/providers/prices/stooq.ts`)

**Páginas:**
- `/login`, `/signup` - Autenticación
- `/watchlist` - Lista de seguimiento
- `/company/[ticker]` - Detalle con 4 tabs (Overview, Financials, Metrics, Models)
- `/settings` - Configuración

**Motor de métricas:** (`src/lib/metrics/`)
- 30+ métricas financieras (ROE, ROIC, margins, P/E, EV/EBITDA, etc.)
- Métricas Greenblatt (Earnings Yield MF, Return on Capital MF)

**Modelos de inversión:** (`src/lib/models/`)
- `buffett.ts` - Calidad + valuación
- `greenblatt.ts` - Magic Formula
- `fisher.ts` - Growth investing
- `lynch.ts` - GARP (PEG ratio)

---

## Variables de entorno (.env):
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/investor_terminal?schema=public"
AUTH_SECRET="dev-secret-key-do-not-use-in-production"
SEC_USER_AGENT="InvestorAnalystTerminal/1.0 (dev@localhost)"
PRICE_PROVIDER="stooq"
CRON_SECRET="dev-cron-secret"
```

---

## Archivos modificados hoy:

1. `docker-compose.yml` - **CREADO** (puerto 5434)
2. `.env` - Actualizado puerto a 5434
3. `src/components/company/company-header.tsx` - Fix refresh button
4. `src/app/(dashboard)/company/[ticker]/page.tsx` - Fix Decimal serialization
5. `src/lib/providers/sec/xbrl-mapper.ts` - Fix revenue mapping

---

## Siguiente paso inmediato:

En la página de AAPL, hacer click en el botón de refresh (icono circular al lado de "In Watchlist") y verificar que:
- Revenue aparezca en Financials → Income Statement
- Metrics muestre datos recientes (2019-2025)
- Si funciona, probar Model Breakdown
