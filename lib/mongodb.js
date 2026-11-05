import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {}

let client;
let clientPromise;

if (!process.env.MONGODB_URI) {
    throw new Error('Agregá MONGODB_URI en tu archivo .env.local');
}

if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri, options);
        global._mongoClientPromise = client.connect();

        // Diagnóstico: a qué base apunta la app (sin credenciales). Comparalo
        // con lo que imprimen `npm run db:wipe` / `npm run db:check-user`.
        try {
            const { hostname } = new URL(uri);
            console.info(`[mongodb] app conectada a ${hostname}, base "${process.env.MONGODB_DB || 'fixea'}"`);
        } catch {
            // URI no parseable: el driver ya va a informar el error.
        }
    }
    clientPromise = global._mongoClientPromise;
} else {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
}

export default clientPromise;