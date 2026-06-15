import https from "https";

https.get("https://sheets.googleapis.com/v4/spreadsheets/1vPZTmPBYi_RlCT4O6EnXz2nRPMqV4StZNCnxB1ZhHJM", (res) => {
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => {
    console.log("Status:", res.statusCode);
    console.log(data.slice(0, 500));
  });
}).on("error", console.error);

