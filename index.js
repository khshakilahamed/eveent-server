const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nqxgtvl.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    // console.log(authHeader);     


    if (!authHeader) {
        res.status(401).send("Unauthorized access");
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' });
        }
        req.decoded = decoded;
        next();
    })

}


async function run() {
    try {
        const database = client.db("eveent");
        const hotelsCollection = database.collection('hotels');
        const usersCollection = database.collection('users');
        const bookingsCollection = database.collection('bookings');

        app.get('/hotels', async (req, res) => {
            const query = {};
            const hotels = await hotelsCollection.find(query).sort({ _id: -1 }).toArray();

            res.send(hotels);
        });

        // update search with date
        app.get('/hotels/search', async (req, res) => {
            const { location } = req.query;
            const query = {};
            const hotels = await hotelsCollection.find(query).toArray();
            const searchResult = hotels.filter(hotel => hotel.location.toLowerCase().includes(location.toLocaleLowerCase()));

            res.send(searchResult);
        });

        app.get('/bookings/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const decodedEmail = req.decoded.email;

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            // console.log(req.headers.authorization);
            const query = { email };
            const bookings = await bookingsCollection.find(query).toArray();

            res.send(bookings);
        });

        app.get('/hotel/details/:id', async (req, res) => {
            const { id } = req.params;
            const filter = { _id: new ObjectId(id) };

            const hotel = await hotelsCollection.findOne(filter);

            res.send(hotel);
        });

        app.get('/hotel/bookings/:email', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'hotelAdmin') {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const { email } = req.params;
            const filter = { hotelEmail: email };
            const bookings = await bookingsCollection.find(filter).toArray();

            res.send(bookings);
        })

        app.get('/users', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' });
            }
            const filter = {};
            const users = await usersCollection.find(filter).toArray();

            res.send(users);
        });

        app.get('/user/:email', async (req, res) => {
            // const decodedEmail = req.decoded.email;
            // const query = { email: decodedEmail };

            // const verifyUser = await usersCollection.findOne(query);

            // if (verifyUser?.role !== 'admin' || verifyUser?.role !== 'hotelAdmin' || decodedEmail !== email) {
            //     return res.status(403).send({ message: 'forbidden access' });
            // }

            const email = req.params.email;
            const filter = { email };
            // const user = await usersCollection.findOne(query, { projection: { role: 1 } });
            const user = await usersCollection.findOne(filter);

            res.send(user);
        });

        app.get('/bookings', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };

            const user = await usersCollection.findOne(query);

            // console.log(user);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' });
            }

            const filter = {};
            const bookings = await bookingsCollection.find(filter).toArray();

            res.send(bookings);
        });


        app.post('/hotels', async (req, res) => {
            const hotelInfo = req.body;
            const result = await hotelsCollection.insertOne(hotelInfo);

            res.send(result);
        });

        app.get('/jwt', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user && user.email == email) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '12h' });
                return res.send({ accessToken: token });
            }
            res.status(403).send({ accessToken: '' });
        })

        app.post('/users', async (req, res) => {
            const usersInfo = req.body;
            // console.log(usersInfo);
            const result = await usersCollection.insertOne(usersInfo);

            res.send(result);
        });

        app.post('/bookings', verifyJWT, async (req, res) => {
            const bookingInfo = req.body;
            const { email, date } = bookingInfo;

            const adminQuery = { email: email };

            const query = {
                email: email,
                date: date,
            }
            const dateQuery = {
                date: bookingInfo.date
            }

            const hallAdmin = await hotelsCollection.findOne(adminQuery);


            if (hallAdmin?.email === email) {
                const message = `Hotel Admin can not make booking`;
                return res.send({ acknowledged: false, message })
            }

            const admin = await usersCollection.findOne(adminQuery);

            if (admin?.role === 'admin') {
                const message = `Admin can not make booking`;
                return res.send({ acknowledged: false, message })
            }

            const alreadyBooked = await bookingsCollection.find(query).toArray();

            if (alreadyBooked.length) {
                const message = `You already have a booking on this day at ${alreadyBooked[0].hotelName}`;
                return res.send({ acknowledged: false, message })
            };

            const alreadyBookedOnThisDay = await bookingsCollection.find(dateQuery).toArray();
            if (alreadyBookedOnThisDay.length) {
                const message = `${bookingInfo.hotelName} is already booked on this day`;
                return res.send({ acknowledged: false, message })
            };


            const result = await bookingsCollection.insertOne(bookingInfo);

            res.send(result);
        })

        app.put('/users', async (req, res) => {
            const userInfo = req.body;
            const filter = { email: userInfo.email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    ...userInfo
                }
            };
            const result = await usersCollection.updateOne(filter, updatedDoc, options);
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

            res.send(result);
        });

        app.put('/user/upload-profile-img', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const profileData = req.body;
            const query = { email: decodedEmail };

            const filter = { email: decodedEmail };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    ...profileData
                }
            }

            const user = await usersCollection.findOne(query);
            if (user.length === 0) {
                res.status(403).send({ message: 'forbidden access' });
            }

            const result = await usersCollection.updateOne(filter, updatedDoc, options);
            res.send(result);
        })

        app.put('/user/makeAdmin/:id/:email', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne({ query });

            if (user?.role !== 'admin') {
                res.status(403).send({ message: 'forbidden access' });
            }

            const { id, email } = req.params;

            const filter = {
                _id: new ObjectId(id),
                email: email
            };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updatedDoc, options);

            res.send(result);
        });

        app.delete('/booking/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookingsCollection.deleteOne(query);

            res.send(result);
        });

        app.delete('/hotel/:id/:email', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);

            if (user?.role !== 'admin') {
                res.status(403).send({ message: 'forbidden access' });
            }
            const { id, email } = req.params;
            const filter = {
                _id: new ObjectId(id),
                email: email
            };
            const result = await hotelsCollection.deleteOne(filter);

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