/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb');
const request = require('request');

const CONNECTION_STRING = process.env.DB; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});

function stockHandler(){
  let result;
  this.handlePrice = function(stock, callback){
  request("https://api.iextrading.com/1.0/stock/"+stock+"/price",function(error, response, body){
  //ChECKING FOR ERRORS 
  if(error){console.log(`Error ${error}`);callback('stockData','external source error')}
  //IF NO ERRORS FOUND-> 
  else{
  result=body;
  callback('stockData', {stock: stock, price:result});
  }
  })
  }
  //.handleLikes(stock,like,ip,manage);
  this.handleLikes = function(stock,like,ip,callback){

  let likes = 0;
  //LIKE IS ADDED
          if(!like){
                //WE LOOK IN THE DB FOR THE STOCK AND SET THE NUMBER OF LIKES ATRIBUTED
              MongoClient.connect(CONNECTION_STRING, function(err, db) {
              var collection = db.collection('stock');
              collection.find({stock:stock})
              .toArray(function(err, doc) {
               //IN CASE THE STOCK IS FOUND, LIKES.VALUE IS OBTAINED FRO THE DB (AGAIN THIS IS THE CASE WHERE WE !!DO NOT!! LIKE THE STOCK)
               if (doc.length > 0){likes = doc[0].likes.length;}
              //WE SET THE CALLBACK TO RETURN THE TICKER, PRICE AND NUMBER OF LIKES FROM THE DB
               callback('likesData',{stock:stock,likes:likes}); //FIGURE OUT THE ERROR!!!!
                                          });
              })
  //NO LIKE IS ADDED
         }else{
           MongoClient.connect(CONNECTION_STRING, function(err, db) {
              var collection = db.collection('stock');
              collection.findAndModify(
              {stock: stock},
              [],
              {$addToSet: { likes: ip }},
              {new: true, upsert: true},
              function(err, doc) {
              if(err){throw err;}
                else{
              // console.log(doc);
               callback('likesData',{stock:stock,likes:doc.value.likes.length});
                    }
              });
          })
         }
  }
}

let stockPrices = new stockHandler();

module.exports = function (app) {

  app.route('/api/stock-prices')
  .get(function(req,res){
     var stock = req.query.stock;
      var like = req.query.like || false;
      var ip = req.connection.remoteAddress;
      var stockData = null;
      var likeData = null;
      var multiple = false;
      if (Array.isArray(stock)) {
        multiple = true;
        stockData = [];
        likeData = [];
      }
      function manageStock(dataType, data) {
        if (dataType == 'stockData') {
          (multiple) ? stockData.push(data) : stockData = data;
        } else {
          (multiple) ? likeData.push(data) : likeData = data;
        }
        
        if (!multiple && stockData && likeData !== null) {
          stockData.likes = likeData.likes;
          res.json({stockData});
        } else if (multiple && stockData.length == 2 && likeData.length == 2) {
          if (stockData[0].stock == likeData[0].stock) {
            stockData[0].rel_likes = likeData[0].likes - likeData[1].likes;
            stockData[1].rel_likes = likeData[1].likes - likeData[0].likes;
          } else {
            stockData[0].rel_likes = likeData[1].likes - likeData[0].likes;
            stockData[1].rel_likes = likeData[0].likes - likeData[1].likes;
          }
          res.json({stockData});
        }
      }
      if (multiple) {
        stockPrices.handlePrice(stock[0], manageStock);
        stockPrices.handleLikes(stock[0], like, ip, manageStock); 
        stockPrices.handlePrice(stock[1], manageStock);
        stockPrices.handleLikes(stock[1], like, ip, manageStock);
      } else {
        stockPrices.handlePrice(stock, manageStock);
        stockPrices.handleLikes(stock, like, ip, manageStock);
      }
   })

};
