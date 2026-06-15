import https from "https";

function fetchUrl(url: string) {
  https.get(url, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
      if (res.headers.location) {
        fetchUrl(res.headers.location);
        return;
      }
    }
    let data = "";
    res.on("data", chunk => data += chunk);
    res.on("end", () => {
      console.log(data.slice(0, 1000));
    });
  }).on("error", console.error);
}

fetchUrl("https://docs.google.com/spreadsheets/d/1vPZTmPBYi_RlCT4O6EnXz2nRPMqV4StZNCnxB1ZhHJM/export?format=csv&gid=0");

