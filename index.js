const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nqxgtvl.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const database = client.db("eveent");
        const hotelsCollection = database.collection('hotels');
        const usersCollection = database.collection('users');

        app.get('/hotels', async (req, res) => {
            const query = {};

            const hotels = await hotelsCollection.find(query).toArray();

            res.send(hotels);
        });

        app.post('/users', async (req, res) => {
            const usersInfo = req.body;
            // console.log(usersInfo);
            const result = await usersCollection.insertOne(usersInfo);

            res.send(result);
        })

        app.put('/user', async (req, res) => {
            const email = req.query.email;
            const userInfo = req.body;
            const filter = { email };
            const options = { upsert: true };

            const updatedDoc = {
                $set: {
                    ...userInfo
                }
            }

            const result = await usersCollection.updateOne(filter, updatedDoc, options);

            console.log(result);
            res.send(result);
        })

    } finally {
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Hello World");
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})