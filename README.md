This project is an example application that shows how to write a FaunaDB login/logout/register without a backend.
FaunaDB's security roles are extremely flexible, in combination with User Defined Function we can 
boostrap the security. 

We start off with a token that can only call two User Defined Functions (like stored procedures) functions (register, login).
Once the user logs in, the token is swapped with a 'login token' which has access to view profiles. 

## Setup the project
We have added scripts to set up all the security roles, collections, indexes and user defined functions to make this work. 
The scripts are meant to get you started easily and to document the process. Take a peek in the scripts/setup.js script to see
how this is setup. To get started, create a database and an Admin token on https://dashboard.fauna.com/, copy the token (you'll need it soon)
and run: 

`npm run setup`

The script will ask for the admin token, do not use the admin token for anything else than the setup script. 
Admin tokens are powerful and meant to manipulate all aspects of the database (create/drop collections/indexes/roles)
The script will give you a new token instead (a login token).
Copy the token and place it in a .env.local file:
`
REACT_APP_LOCAL___BOOTSTRAP_FAUNADB_KEY=<YOUR FAUNA LOGIN KEY>
`

## Run the project
This project has been created with create-react-app and therefore has all the same commands such as 
`npm start`

## What it does not do
### Short-lived tokens
At this point, FaunaDB does not provide short-lived tokens but it **can** be implemented fairly easily.
This means that login tokens stick around unless you clean them up.
We will soon add a script that can be ran on a serverless function to clean up tokens that have become too old. 
Note that short-lived tokens are on the roadmap

### Rate-limiting
For some users, being able to connect to the database from the frontend is not acceptable without rate-limiting. 
Session-based limiting can be implemented in FaunaDB, we will provide another example that builds upon this one with such an implementation.
IP-based limiting is atm not possible to implement solely with FaunaDB, we will soon provide an example does rate-limiting using CloudFlare Workers. 


## Tests
Some developers find it easy to look at the results of tests to see how something works.
For those guys we have added integration tests to show how the different components work. 

### Set up the tests
In FaunaDB you can make as many databases as you want and place them in other databases.
This can come in handy if you want to run multiple integration tests concurrently against FaunaDB or just to keep
An overview. We chose to run each test suite in one database, for that we have defined multiple tokens in .env.test.local, one for each test suite

TODO

### Run the tests
`npm test`
