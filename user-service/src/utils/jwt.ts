import jwt, { sign, verify, type SignOptions } from 'jsonwebtoken'
import config from '../config'

export function signJwt(object: Object, keyName: 'privateKey' | 'refreshPrivateKey', options?: SignOptions) {
    const signingKey = Buffer.from(config.get(keyName), 'base64').toString('ascii')

    const defaultOptions: SignOptions = {
        expiresIn: '1h',
        ...(options && options),
        algorithm: 'RS256',
    }

    return sign(object, signingKey, defaultOptions)
}

type VerifyJwtResponse = {
    err: boolean;
    decoded: jwt.JwtPayload | string | null;
    message: string;
}

export function verifyJwt(token: string, keyName: 'publicKey' | 'refreshPublicKey') {
    const result: VerifyJwtResponse = {
        err: false,
        decoded: null,
        message: '',
    }
    const publicKey = Buffer.from(config.get(keyName), 'base64').toString('ascii')

    try {
        result.decoded = verify(token, publicKey)
        return result
    } catch (e: unknown) {
        result.err = true
        if (e instanceof Error) {
            result.message = e.message
        }
        return result
    }
}
