// Prisma config for the runtime image.
//
// Mirrors apps/api/prisma.config.ts but drops the `dotenv/config` import and
// the seed entry: inside the container DATABASE_URL comes from the environment
// rather than a .env file, and seeding runs with tsx, which is a devDependency
// and therefore absent from the pruned runtime install.
//
// Paths are relative to /app, the image's working directory.
module.exports = {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
};
