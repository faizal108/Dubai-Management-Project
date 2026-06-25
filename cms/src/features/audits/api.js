// src/features/audits/api.js
// SUPERADMIN-only audit log listing. Filters: actorId, entity, entityId,
// action, foundationId, from/to (date range), q (free-text), and paging.

import { api, withQuery } from "../../lib/api";

const BASE = "/audits";

export const listAudits = (params) => api.get(withQuery(BASE, params));
