import PasswordlessNode from 'supertokens-node/recipe/passwordless'
import SessionNode from 'supertokens-node/recipe/session'
import { appInfo } from './appInfo'
import { TypeInput } from "supertokens-node/types";
import Dashboard from "supertokens-node/recipe/dashboard";
import jwt from "supertokens-node/recipe/jwt"

export const backendConfig = (): TypeInput => {
  return {
    framework: "express",
    supertokens: {
      connectionURI: process.env.SUPERTOKENS_CONNECTION_URI ?? "",
      apiKey: process.env.SUPERTOKENS_API_KEY ?? "",
    },
    appInfo,
    recipeList: [
      PasswordlessNode.init({
        flowType: "MAGIC_LINK",
        contactMethod: "EMAIL"
      }),
      SessionNode.init(),
      Dashboard.init({
        apiKey: process.env.SUPERTOKENS_API_KEY ?? "",
      }),
      jwt.init(),
    ],
    isInServerlessEnv: true,
  }
}
