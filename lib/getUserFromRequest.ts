import { NextApiRequest } from "next";
import { verifyJwtToken } from "./auth";

export const getUserIdFromRequest = async (req: NextApiRequest) => {
    const token = req.cookies.token;
    const verifiedToken = await verifyJwtToken(token);
    if (!verifiedToken) return null;
    return verifiedToken.userId as string;
}