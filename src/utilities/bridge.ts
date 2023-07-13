import fetch from "node-fetch";


const bridgeURL = "http://localhost:5468/";
const signalRUrl = `${bridgeURL}signalr/`;
const hubsUrl = `${signalRUrl}hubs`; 

export async function connectBridge() : Promise<boolean> {
  
  let result : boolean = true;
  
  const options: any = {
    method: "GET"
  };

  try {
    const response = await fetch(hubsUrl, options);
    await response.text();
    console.log(`STARLIMS Bridge running on ${bridgeURL}`);
  } 
  catch (e: any) {
    result = false;
    console.log(`STARLIMS Bridge is not reachable on ${bridgeURL}`);
  }

  return result;
};

