import { jwtVerify } from 'jose';

export const getJwtSecretKey = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length === 0) {
        throw new Error('The environment variable JWT_SECRET is not set.');
    }
    return new TextEncoder().encode(secret);
};

export async function verifyJwtToken(token: string | undefined) {
    if (!token) {
        return null;
    }
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());
        return payload;
    } catch (error) {
        return null;
    }
}