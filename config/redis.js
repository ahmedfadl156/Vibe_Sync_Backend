import { createClient } from 'redis';

export const redisClient = createClient({
    username: 'default',
    password: 'ykuk6KKfipaZPC5lildhHsSzvHrBe7um',
    socket: {
        host: 'redis-19192.c244.us-east-1-2.ec2.cloud.redislabs.com',
        port: 19192
    }
});

redisClient.on('error', err => console.log('Redis Client Error', err));

await redisClient.connect();


