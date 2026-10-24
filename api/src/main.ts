import { createServer } from "node:http";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { expressMiddleware } from "@as-integrations/express5";
import express from "express";
import { env, manifest } from "./config.ts";
import { type Context, createContext } from "./context.ts";
import { joinErxesGateway } from "./gateway.ts";
import { resolvers, typeDefs } from "./graphql/schema.ts";

const app = express();
app.disable("x-powered-by");

const httpServer = createServer(app);

const apollo = new ApolloServer<Context>({
  schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});
await apollo.start();

app.get(manifest.api.health, (_req, res) => {
  res.json({ ok: true });
});

app.use(
  manifest.api.graphql,
  express.json({ limit: "15mb" }),
  expressMiddleware(apollo, { context: async ({ req }) => createContext(req.headers) }),
);

await new Promise<void>((resolve) => httpServer.listen(env.PORT, resolve));
console.log(
  `${manifest.name} API listening on http://localhost:${env.PORT}${manifest.api.graphql}`,
);

const address = await joinErxesGateway();
console.log(`${manifest.name} joined the erxes gateway as ${address}`);

const shutdown = async () => {
  await apollo.stop();
  process.exit(0);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
