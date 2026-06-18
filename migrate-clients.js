const mongoose = require('mongoose');

async function run() {
  await mongoose.connect("mongodb+srv://ryshoe_db_user:RVUEoG2bpz2tox26@companymanager.jfriycn.mongodb.net/company-manager?retryWrites=true&w=majority&appName=companymanager");
  console.log('Connected to MongoDB');

  const ProjectSchema = new mongoose.Schema({
    organizationId: mongoose.Schema.Types.ObjectId,
    projectType: String,
    clientId: mongoose.Schema.Types.ObjectId,
    name: String,
    url: String,
    urls: [String],
    logo: String,
    color: String,
    userIds: [mongoose.Schema.Types.ObjectId],
  }, { strict: false });
  const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);

  const ClientSchema = new mongoose.Schema({
    organizationId: mongoose.Schema.Types.ObjectId,
    name: String,
    domain: String,
    logo: String,
    color: String,
    status: String,
    userIds: [mongoose.Schema.Types.ObjectId],
  }, { strict: false });
  const Client = mongoose.models.Client || mongoose.model('Client', ClientSchema);

  const projectsToMigrate = await Project.find({
    projectType: 'client',
    clientId: { $exists: false }
  });

  console.log(`Found ${projectsToMigrate.length} client projects to migrate.`);

  let count = 0;
  for (const project of projectsToMigrate) {
    let client = await Client.findOne({ organizationId: project.organizationId, name: project.name });

    if (!client) {
      console.log(`Creating client: ${project.name}`);
      client = await Client.create({
        organizationId: project.organizationId,
        name: project.name,
        domain: project.url || (project.urls && project.urls[0]),
        logo: project.logo,
        color: project.color,
        status: 'active',
        userIds: project.userIds || []
      });
    }

    project.clientId = client._id;
    await project.save();
    count++;
  }

  console.log(`Successfully migrated ${count} projects to use clients.`);
  process.exit(0);
}

run().catch(console.error);
