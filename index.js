const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const jwt = require('jsonwebtoken');
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 5000;

// middleware 
app.use(cors())
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded
        next();
    })
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zdzdyrx.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const usersCollection = client.db('glamHub').collection('users');
        const allCoursesCollection = client.db('glamHub').collection('allCourses');
        const cartCollection = client.db('glamHub').collection('carts');


        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token });
        })

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            next();
        }

        /* {-----------users Collection-----------} */

        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        // app.post('/users', async (req, res) => {
        //     const user = req.body;
        //     const query = { email: user?.email }
        //     const existingUser = await usersCollection.findOne(query);
        //     if (existingUser) {
        //         res.send({ message: 'User already exists' });
        //     }
        //     const result = await usersCollection.insertOne(user);
        //     res.send(result);
        // })

        app.post('/users', async (req, res) => {
            try {
                const user = req.body;
                const query = { email: user?.email };
                const existingUser = await usersCollection.findOne(query);

                if (existingUser) {
                    res.status(409).send({ message: 'User already exists' });
                } else {
                    const result = await usersCollection.insertOne(user);
                    const insertedUser = result.ops[0]; // Get the inserted user details
                    res.status(201).send({ message: 'User created successfully', user: insertedUser });
                }
            } catch (error) {
                console.error('Error creating user:', error);
                res.status(500).send({ message: 'Internal server error' });
            }
        });

        // {3 steps verification: 1)verifyJWT. 2)same email. 3) check admin.}
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);

        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: `admin`
                },
            };
            const result = await usersCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })


        /* {-----------allCourses Collection-----------} */

        // get all the courses
        app.get('/allCourses', async (req, res) => {
            const result = await allCoursesCollection.find().toArray();
            res.send(result);
        })

        // get specific courses by category..
        app.get('/allCourses/:category', async (req, res) => {
            const courseName = req.params.category;
            const query = { category: courseName };
            const result = await allCoursesCollection.find(query).toArray();
            res.send(result);
        })

        // get specific course details..
        app.get('/allCourses/category/:id', async (req, res) => {
            const id = req.params.id;
            const query = { course_id: id };
            const result = await allCoursesCollection.findOne(query);
            res.send(result);
        })

        app.post('/allCourses', verifyJWT, verifyAdmin, async (req, res) => {
            const newCourse = req.body;
            const result = await allCoursesCollection.insertOne(newCourse);
            res.send(result);
        })

        app.delete('/allCourses/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await allCoursesCollection.deleteOne(query);
            res.send(result);
        })

        // get all the instructors
        app.get('/allInstructors', async (req, res) => {
            const result = await allCoursesCollection.find().toArray();
            res.send(result);
        })

        // get specific instructors by category..
        app.get('/allInstructors/:category', async (req, res) => {
            const instructorName = req.params.category;
            const query = { category: instructorName };
            const result = await allCoursesCollection.find(query).toArray();
            res.send(result);
        })

        /* {-----------cart Collection-----------} */

        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await cartCollection.insertOne(item);
            res.send(result);
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.log);

app.get('/', (req, res) => {
    res.send('Hello GlamHub!')
})

app.listen(port, () => {
    console.log(`Your server is running on port ${port}`)
})