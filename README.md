# ms-go-node-12102024

```
cd _scripts/mongo
docker compose up -d

docker exec -it mongo1 mongosh --eval "rs.initiate({_id:\"my-replica-set\",members:[{_id:0,host:\"mongo1:27017\"},{_id:1,host:\"mongo2:27018\"},{_id:2,host:\"mongo3:27019\"}]})"

cd _scripts/app
docker compose up -d
```
