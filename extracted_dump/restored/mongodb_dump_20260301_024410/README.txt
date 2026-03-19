MongoDB Database Dump
=====================

Export Date: 03/01/2026 02:44:16
Database: ClickUp Clone
Collections: 35
Total Size: 0.72 MB

Collections Exported:
--------------------
activities
activitylogs
announcements
attachments
auditlogs
chatmessages
conversations
customfields
customfieldvalues
customtables
devicetokens
directmessages
documents
feedbacks
foldermembers
folders
invitations
listmembers
lists
notifications
plans
projects
spaceinvitations
spacemembers
spaces
systemsettings
tablemembers
taskcomments
taskdependencies
tasks
timeentries
users
workspaceactivities
workspacefiles
workspaces


To Restore This Dump:
--------------------
mongorestore --uri="YOUR_MONGODB_URI" .

Or restore specific collection:
mongorestore --uri="YOUR_MONGODB_URI" --collection=COLLECTION_NAME ./DATABASE_NAME/COLLECTION_NAME.bson

Notes:
------
- Make sure MongoDB Database Tools are installed
- Replace YOUR_MONGODB_URI with your actual MongoDB connection string
- The restore will create/overwrite collections in the target database
- Backup created from: mongodb+srv://aashisacharya60_db_user:WgaHbc9T1tJZxvYD@clickup-prototype.0pj6qdz.mongodb.net/?appName=clickup-prototype

Super Admin Credentials:
-----------------------
Email: ashisacharya@gmail.com
Password: ashisacharya@123
