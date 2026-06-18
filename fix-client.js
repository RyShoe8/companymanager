const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://ryshoe_db_user:RVUEoG2bpz2tox26@companymanager.jfriycn.mongodb.net/company-manager?retryWrites=true&w=majority&appName=companymanager');
  const Client = mongoose.model('Client', new mongoose.Schema({}, { strict: false }));
  const c = await Client.updateOne(
    { name: 'Senior By Design' },
    { $set: { organizationId: new mongoose.Types.ObjectId('69649e6f47fdc3d2731d6886') } }
  );
  console.log(c);
  process.exit(0);
}

run();
