package main

import (
	"log"
	"net/http"
)

func serveDefault(w http.ResponseWriter, r *http.Request) {
	log.Println(r.URL)
	if r.URL.Path != "/" {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	http.ServeFile(w, r, "home.html")
}

func main() {
	hub := H
	go hub.Run()
	http.HandleFunc("/", serveDefault)
	http.HandleFunc("/ws", ServeWs)
	//Listerning on port :8080...
	log.Fatal(http.ListenAndServe(":8080", nil))
}
