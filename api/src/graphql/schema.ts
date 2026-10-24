import type { GraphQLResolverMap } from "@apollo/subgraph";
import { gql } from "graphql-tag";
import { manifest } from "../config.ts";
import type { Context } from "../context.ts";

// Every type and operation is prefixed with the plugin name: the gateway
// composes all plugins into one supergraph, so names must be unique across it.
export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.9", import: ["@key"])

  type ClassradarStatus {
    plugin: String!
    version: String!
    subdomain: String!
    userId: String
    userEmail: String
  }

  type Query {
    classradarStatus: ClassradarStatus!
  }
`;

export const resolvers: GraphQLResolverMap<Context> = {
  Query: {
    classradarStatus: (_parent, _args, { subdomain, user }) => ({
      plugin: manifest.name,
      version: manifest.version,
      subdomain,
      userId: user?._id ?? null,
      userEmail: user?.email ?? null,
    }),
  },
};
