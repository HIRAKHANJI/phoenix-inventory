const knex = require('knex')(require('../knexfile').development);

async function check() {
  try {
    const columns = await knex('stock').columnInfo();
    console.log(JSON.stringify(columns, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await knex.destroy();
  }
}

check();
