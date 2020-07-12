This project is an example of how to a 'real-world' app with highly dynamic data in a serverless fashion using React hooks, FaunaDB, and Cloudinary. Since FaunaDB was developed by ex-Twitter engineers, a Twitter-like application felt like an appropriately sentimental choices so we call this serverless baby ‘Fwitter’. 

<img src="https://github.com/fauna-brecht/fwitter/blob/master/readme/fwitter.png?raw=true" width="600">

There is a first [CSS-tricks article](https://css-tricks.com/rethinking-twitter-as-a-serverless-app/) that describes the application in general, explains auth, data modeling and simple queries and brushes over the other features. 
More articles are coming on the [Fauna blog](https://fauna.com/blog) and/or CSS Tricks


It uses the Fauna Query Language (FQL) and starts with a frontend-only approach that directly accesses the serverless database FaunaDB for data storage, authentication, and authorization. 

<img src="https://github.com/fauna-brecht/fwitter/blob/master/readme/stack1.png?raw=true" width="400">

A few features are still missing and will be covered in future articles, including streaming, pagination, benchmarks, and a more advanced security model with short-lived tokens, JWT tokens, single sign-on (possibly using a service like Auth0), IP-based rate limiting (with Cloudflare workers), e-mail verification (with a service like SendGrid), and HttpOnly cookies.

<img src="https://github.com/fauna-brecht/fwitter/blob/master/readme/stack2.png?raw=true" width="400">


## Setup the project
This app was created with Create React App, to start using it we need to: 

### Install npm packages
`npm install`

### Setup the database

To set up the project, go to the [FaunaDB Dashboard](https://dashboard.fauna.com/) and sign up. 

<img src="https://github.com/fauna-brecht/fwitter/blob/master/readme/sign_up.png?raw=true" width="600">

Once you are in the dashboard, click on New Database, fill in a name, and click Save. 
<img src="https://github.com/fauna-brecht/fwitter/blob/master/readme/new_database.png?raw=true" width="600">

<img src="https://github.com/fauna-brecht/fwitter/blob/master/readme/new_database2.png?raw=true" width="600">

You should now be on the "Overview" page of your new database. 
Next, to manipulate the database from within our setup scripts, we need a key. Click on the Security tab in the left sidebar, then click the New key button. 

<img src="https://github.com/fauna-brecht/fwitter/blob/master/readme/admin_key1.png?raw=true" width="600">

In the "New key" form, the current database should already be selected. For "Role", leave it as "Admin" and give it a name.

<img src="https://github.com/fauna-brecht/fwitter/blob/master/readme/admin_key2.png?raw=true" width="600">

Next, click Save and copy the key secret displayed on the next page. It will not be displayed again.

<img src="https://github.com/fauna-brecht/fwitter/blob/master/readme/admin_key3.png?raw=true" width="600">

You now have the option to place it in your environment variables (REACT_APP_LOCAL___ADMIN) via .env.local, we have provided an example file .env.local.example that you can rename. Although the .env.local file is gitignored, make sure not to push your admin key, this key is powerful and meant to stay private. The setup scripts will therefore also ask you the key if you did not place it in your environment vars so you could opt to paste them in then instead.

```
REACT_APP_LOCAL___ADMIN=<insert your admin key>
```

We have prepared a few scripts so that you only have to run the following commands to initialize your app, create all collections, and populate your database. The scripts will ask for the admin token that you have created and will give you further instructions.  
```
// run setup, this will create all the resources in your database
// provide the admin key when the script asks for it. 
npm run setup
```
When this script has finished setting up everything you will receive a new key which will automatically be written in your .env.local file (or create this file if it doesn't exist yet from the example file). This key is the bootstrap key that has very tight permissions (it can only register and login) and will be used to bootstrap our application. 
```
REACT_APP_LOCAL___BOOTSTRAP_FAUNADB_KEY=<insert faunadb bootstrap key>
```

### Populate the database (optional)
We also provided a script that adds some data to the database (accounts, users, fweets, comments, likes, etc..) for you to play around with, it will use or ask the same admin key.

```
npm run populate
```

Once you do, you will get 4 users to login with: 
- user1@test.com
- user2@test.com
- user3@test.com
- user4@test.com

all with password: 'testtest'

If you do not see a lot on the feed yet of the user you logged in with, search for another user (type in a letter such as 'b' or 'a') and click the + sign to follow him/her.

### Setup cloudinary. 

We use [Cloudinary](https://cloudinary.com/) to allow users to upload media, automatically optimise and serve this media which will be linked to the data of our application such as video and images. It's truly quite amazing what Cloudinary does behind the scenes. To see this feature in action, create an account with Cloudinary and add your cloudname and a public template (there is a default template called ‘ml_default’ which you can make public) to the environment. 
```
REACT_APP_LOCAL___CLOUDINARY_CLOUDNAME=<cloudinary cloudname>
REACT_APP_LOCAL___CLOUDINARY_TEMPLATE=<cloudinary template>
```

## Run the project
This project has been created with [Create React App](https://reactjs.org/docs/create-a-new-react-app.html#create-react-app)and therefore has the same familiar commands such as 

`npm start`

to start your application. 

## Tests
Although we did our best to comment all FaunaDB queries as extensively as possible and even wrote the queries in multiple steps that gradually increase the complexity, some developers find it easier to look at the results of tests to see how something works.For those guys/girls we have added a few integration tests to show how a few of the queries work. 

### Set up the tests
In FaunaDB you can make as many databases as you want and place them in other databases.
This can come in handy if you want to run multiple integration tests concurrently against FaunaDB or just to keep
An overview. We chose to run each test suite in one database. These tests expect that you have created a database and placed an admin key for that database in .env.test.local for which we also provided an example file. You can choose to keep your database for tests separated from your application database but you can also simply paste in the admin key that you used before, the tests will create and destroy child test databases for you on the fly when tests run.
```
REACT_APP_TEST__ADMIN_KEY=<your test database key>
```

### Run the tests
`npm test`


### Update something in the setup
What if I am experimenting and want to update something? 
To update User Defined Functions or Roles you can just alter the definition and run `npm run setup` again, it will verify whether the role/function exists and override it.

One thing that can't be altered just like that are indexes (makes sense of course, they could contain quite some data). 
In order to just setup from scratch again you can run `npm run destroy` followed by `npm run setup`. Note, that since names such as collections and indexes are cached, you will have to wait +-60 secs but we can easily get around that by just removing and adding the complete database. In that case, we would remove our ADMIN key as well which would mean that we have to generate a new one each time. However, if we just create an admin key and use that to add (on setup) and remove (on destroy) a child database, than we can get around that inconvenience. We have provided you with that option. When you add the environment variable 'REACT_APP_LOCAL___CHILD_DB_NAME', the script will create a child database on `npm run setup` and destroy it on `npm run destroy` instead of removing all collections/indices/functions. 
