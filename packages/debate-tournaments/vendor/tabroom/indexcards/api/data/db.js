/**
 * debate-tournaments overlay — replaces upstream's `api/data/db.js`.
 *
 * Upstream's Sequelize handle, reduced to the calls the vendored routes make
 * (`db.sequelize.query`, `db.Sequelize.QueryTypes`, `db.<table>.findOne/All`,
 * `db.summon`) and bound to the current request's D1 database. See
 * `src/db/sequelize-shim.ts`.
 */
import { createSequelizeShim } from '../../../../../src/db/sequelize-shim.js';
import { getTabroomD1 } from '../../../../../src/db/runtime.js';

const db = createSequelizeShim(getTabroomD1);

export default db;
