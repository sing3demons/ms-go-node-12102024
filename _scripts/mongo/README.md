# Start MongoDB Replica Set

```
docker compose up -d
```

# Initialize Replica Set

```
docker exec -it mongo1 mongosh --eval "rs.initiate({_id:\"my-replica-set\",members:[{_id:0,host:\"mongo1:27017\"},{_id:1,host:\"mongo2:27018\"},{_id:2,host:\"mongo3:27019\"}]})"

docker exec -it mongo2 mongosh --port 27018 --eval 'db.getMongo().setReadPref("secondaryPreferred");'
docker exec -it mongo3 mongosh --port 27019 --eval 'db.getMongo().setReadPref("secondaryPreferred");'

docker exec -it mongo2 mongosh --port 27018 --eval 'db.getMongo().getReadPref()'
docker exec -it mongo3 mongosh --port 27019 --eval 'db.getMongo().getReadPref()'


```