import supertokens from 'supertokens-node'
import { superTokensNextWrapper } from 'supertokens-node/nextjs'
import { verifySession } from 'supertokens-node/recipe/session/framework/express'
import { backendConfig } from '../../config/backendConfig'
import NextCors from "nextjs-cors";
import PasswordlessNode from 'supertokens-node/recipe/passwordless'

supertokens.init(backendConfig());

export default async function user(req: any, res: any) {
    // NOTE: We need CORS only if we are querying the APIs from a different origin
    await NextCors(req, res, {
        methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
        origin: process.env.NEXT_PUBLIC_APEIRO_UI,
        credentials: true,
        allowedHeaders: ["content-type", ...supertokens.getAllCORSHeaders()],
    });

    // we first verify the session
    await superTokensNextWrapper(
        async (next) => {
            return await verifySession()(req, res, next)
        },
        req, res
    )
    // if it comes here, it means that the session verification was successful

    let userId = req.session!.getUserId();
    let userInfo = await PasswordlessNode.getUserById({ userId });

    return res.json({
        note:
            'Fetch any data from your application for authenticated user after using verifySession middleware',
        email: userInfo?.email,
        userId: req.session.getUserId(),
        sessionHandle: req.session.getHandle(),
        accessToken: req.session.accessToken,
        // userDataInAccessToken: req.session.getAccessTokenPayload(),
    })
}