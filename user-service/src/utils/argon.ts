import * as argon2 from "argon2"
import logger from "../logger/logger"

export async function hashPassword(password: string): Promise<string> {
    return argon2.hash(password)
}


export async function verifyPassword(hashedPassword: string, password: string): Promise<boolean> {
    return argon2.verify(hashedPassword, password)
}

export default class Bcrypt {
    constructor(private readonly node: string) { }

    async hashPassword(password: string): Promise<string> {
        logger.debug(`${this.node} ===> hashPassword`)
        try {
            const hash = await argon2.hash(password)
            return hash
        } catch (error) {
            logger.error(`${this.node} ===> Error hashing password`, error)
            throw error
        }
    }

    async verifyPassword(hashedPassword: string, password: string): Promise<boolean> {
        logger.debug(`${this.node} ===> verifyPassword`)

        try {
            return await argon2.verify(hashedPassword, password)
        } catch (error) {
            logger.error(`${this.node} ===> Error verifying password`, error)
            throw error
        }
    }
}