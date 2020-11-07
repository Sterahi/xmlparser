const express = require("express");
const axios = require("axios").default;

/**
 * We want to access the browser's parser to manipulate our xml easily. JSDom lets us do that.
 */
const jsdom = require("jsdom");
const {
  JSDOM
} = jsdom;

const app = express();
const port = 3000;
let preloadedData
/**
 * We could spice this up by allowing users to post a body & we take that string
 * But for simplicity we've just hardcoded our URLs
 */
app.get("/", async (_req, res) => {
  res.json(await getJson())
});

app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`);
});

const getManufacturers = async () => {
  const results = await axios.get(
    "https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=XML"
  );
  return parseXML(results.data, "AllVehicleMakes");
};

/**
 * Get models for specified URL
 * @param {STRING} url in the rough form of: `https://vpic.nhtsa.dot.gov/api/vehicles/GetVehicleTypesForMakeId/${vehicleId}?format=xml`
 */
const getModels = async (url) => {
  const models = await axios.get(url);
  const parsedData = await parseXML(models.data, "VehicleTypesForMakeIds")
  return parsedData;
};

/**
 * We return an instance of the parser to manipulate & grab the data elsewhere.
 * @param {STRING} xmlString String containing XML data
 * @param {STRING} targetNode what node in the XML do we want to target
 */
const parseXML = (xmlString, targetNode) => {
  const dom = new JSDOM("");
  const DOMParser = dom.window.DOMParser;
  const parser = new DOMParser();
  //TODO: name thing better
  const xmlBody = parser
    .parseFromString(xmlString, "text/xml")
    .getElementsByTagName(targetNode);

  return xmlBody;
};

/**
 * Build JSON to be sent.
 */
const getJson = async () => {
  // SUPER basic cache.
  if (preloadedData !== undefined) {
    return {
      status: 200,
      message: "Request Succesful",
      manufacturerModel: preloadedData,
    }
  }

  const manufacturersModels = [];
  let manufacturerId = 0;
  let vehicleModels = [];
  const manufacturers = await getManufacturers()
  try {
    // setting to 500 entries for sanity & proof of concept. It will handle all but it does take ~ 15 minutes to run.
    // For demo purposees it's 500, if you want to run all 10k ^ nth entries I suggest making some good coffee/tea.
    for (manufacturer = 0; manufacturer < 500 /*manufacturers.length*/ ; manufacturer++) {
      manufacturerId = manufacturers[manufacturer].getElementsByTagName("Make_ID")[0]
        .childNodes[0].nodeValue;
      const models = await getModels(
        `https://vpic.nhtsa.dot.gov/api/vehicles/GetVehicleTypesForMakeId/${manufacturerId}?format=xml`
      );
      for (model = 0; model < models.length; model++) {
        vehicleModels.push({
          typeId: models[model].getElementsByTagName("VehicleTypeId")[0]
            .childNodes[0].nodeValue,
          typeName: models[model].getElementsByTagName("VehicleTypeName")[0]
            .childNodes[0].nodeValue,
        })
      }
      manufacturersModels.push({
        makeId: manufacturers[manufacturer].getElementsByTagName("Make_ID")[0]
          .childNodes[0].nodeValue,
        makeName: manufacturers[manufacturer].getElementsByTagName("Make_Name")[0]
          .childNodes[0].nodeValue,
        vehicleTypes: vehicleModels,
      });
      // Clear vehicleModels array for the next run.
      vehicleModels = [];
    }
    preloadedData = manufacturersModels
    return {
      status: 200,
      message: "Request Succesful",
      manufacturerModel: manufacturersModels,
    }
  } catch (e) {
    return {
      status: 400,
      message: e.message,
    };
  }
}