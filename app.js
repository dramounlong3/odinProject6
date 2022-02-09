import express from "express";
import ejs from "ejs";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer();
const io = new Server(server);

//載入靜態資料夾
app.use(express.static("scss"));
app.use(express.static("package"));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/second", (req, res) => {
  res.send("in the second page.");
});

app.get("*", (req, res) => {
  res.status(404).send("Not found.");
});

let roomNum = 1;
let roomContains = 0;

//監聽連線事件
io.on("connection", (socket) => {
  let player = {
    id: socket.id,
    ready: false,
  };

  //chechk if the room size = 2, and the next socket should join another room
  if (roomContains === 2) {
    roomNum++;
    roomContains = 0;
  }

  //join the room
  socket.join(`room${roomNum}`);

  //change data tyep from set to array, and esaily get the room number of the client
  let clientArray = [...socket.rooms];

  //記錄使用者的房間號碼
  player.roomNum = clientArray[1];
  //record the client number of the room, to avoid first time check will cause size is undefined.
  roomContains = io.sockets.adapter.rooms.get(`room${roomNum}`).size;

  /***********************************************game*********************************/

  //使用者連線即回傳房間人數
  io.to(clientArray[1]).emit("roomContains", { roomContains });

  //接收start
  socket.on("start", (cs) => {
    player.ready = cs.ready;
    console.log("player id= " + player.id);
    console.log("player room= " + player.roomNum);
    if (player.ready) {
      io.to(player.roomNum).emit("enableStart", { ready: player.ready });
    }
  });

  //接收restart, 並讓對方重新設定相關變數
  socket.on("restart", (rcs) => {
    console.log("player id= " + player.id);
    console.log("player room= " + player.roomNum);

    //通知另外一位玩家設定資訊
    socket.to(player.roomNum).emit("enableRestart", {
      boxSymbol: rcs.boxSymbol,
      turnRound: rcs.turnRound,
    });
  });

  //接收restart第二位玩家設定後，通知雙方開始遊戲
  socket.on("notifyRestart", () => {
    io.to(player.roomNum).emit("restartGame");
  });

  //發送第一位玩家得資訊給對手
  socket.on("gameInfo", (info) => {
    socket.to(player.roomNum).emit("gameInfo", {
      boxSymbol: info.boxSymbol,
      turnRound: info.turnRound,
    });
  });

  //接收使用者按的九宮格資訊
  socket.on("clickNum", (clickNum) => {
    //發給對手9宮格號碼
    socket.to(clientArray[1]).emit("deliverNum", {
      clickNum: clickNum.num,
      gameOver: clickNum.gameOver,
      draw: clickNum.draw,
    });
  });

  //監聽使用者離開
  socket.on("disconnect", (e) => {
    console.log("leave= " + socket.id);
    socket.to(clientArray[1]).emit("leave");
  });

  /**********chatroom*****************/
  console.log(socket.rooms);
  console.log(clientArray[1]);

  //socket.emit("sm", { message: "hello" });

  socket.on("cm", (cms) => {
    console.log("special ID: " + cms.cid);
    console.log("says: " + cms.cmsg);
    //傳給同一個房間的使用者，除自己之外
    //socket.to(clientArray[1]).emit("sm", { message: cms.cmsg, cname: cms.cnmae });
    //傳給同一個房間的使用者，包含自己，與上面不能並存
    io.to(`${clientArray[1]}`).emit("sm", {
      message: cms.cmsg,
      cname: cms.cname,
    });
  });
  console.log("a new user is connected and ID: " + socket.id);
});

const appServer = app.listen(3000, () => {
  console.log("the server is running on port 3000.");
});

//監聽socket event
io.listen(appServer);
