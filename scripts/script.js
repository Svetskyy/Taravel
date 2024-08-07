// * Initialization
let algResults;
let sourceCoordinates;
let destCoordinates;
let routeInstructions = {};

function extractKeyNodes(path) {
  let lastType = null;
  let keyNodes = [];
  for (let i = 0; i < path.length; i++) {
    let currentType = `${path[i].split("_")[0]} ${path[i].split("_")[1]} ${
      path[i].split("_")[2]
    }`;
    if (lastType !== currentType) {
      keyNodes.push(path[i]);
    } else if (
      i === path.length - 1 ||
      path[i + 1].split("_")[0] !== lastType
    ) {
      keyNodes.push(path[i]);
    }
    lastType = currentType;
  }
  return keyNodes;
}


async function plotRouteOnMap(path, nodes, links, routeType) {
  routeMarkers[routeType] = {};
  routePolylines[routeType] = [];

  const keyNodes = extractKeyNodes(path);
  const filteredNodes = nodes.filter((node) => path.includes(node.id));

  filteredNodes.forEach((node) => {
    let nodeColor = keyNodes.includes(node.id) ? getRandomColor() : "#000000";
    let marker = new google.maps.Circle({
      center: { lat: node.x, lng: node.y },
      map: map, // Make sure the marker is added to the map
    });
    routeMarkers[routeType][node.id] = marker;
  });

  let walkMarkerAdded = false;
  let jeepMarkerAdded = false;
  let tricMarkerAdded = false;

  let lastLinkIndex = -1;

  for (let i = 0; i < path.length - 1; i++) {
    let sourceID = path[i];
    let targetID = path[i + 1];
    let link = links.find(
      (l) =>
        (l.source === sourceID && l.target === targetID) ||
        (l.target === sourceID && l.source === targetID)
    );

    let lineColor = "#000000"; // Default color

    if (link) {
      if (link.type == "walk") {
        lineColor = "#3498db";
        if (!walkMarkerAdded) {
          walkMarkerAdded = true;
          let sourceNode = routeMarkers[routeType][sourceID];
          let walkMarker = new google.maps.Marker({
            position: sourceNode.getCenter(),
            icon: {
              url: "images/walk.png",
              scaledSize: new google.maps.Size(30, 30),
            },
            map: map,
            zIndex: 1,
          });
          routeMarkers[routeType][`walkMarker_${i}`] = walkMarker;
        }
        jeepMarkerAdded = false;
        tricMarkerAdded = false;
      } else if (link.type == "jeep") {
        lineColor = "#e74c3c";
        if (!jeepMarkerAdded) {
          jeepMarkerAdded = true;
          let sourceNode = routeMarkers[routeType][sourceID];
          let jeepMarker = new google.maps.Marker({
            position: sourceNode.getCenter(),
            icon: {
              url: "images/jeep.png",
              scaledSize: new google.maps.Size(30, 30),
            },
            map: map,
            zIndex: 1,
          });
          routeMarkers[routeType][`jeepMarker_${i}`] = jeepMarker;
        }
        walkMarkerAdded = false;
        tricMarkerAdded = false;
      } else if (link.type == "tricycle") {
        lineColor = "#9434cc";
        if (!tricMarkerAdded) {
          tricMarkerAdded = true;
          let sourceNode = routeMarkers[routeType][sourceID];
          let tricMarker = new google.maps.Marker({
            position: sourceNode.getCenter(),
            icon: {
              url: "images/tric.png",
              scaledSize: new google.maps.Size(30, 30),
            },
            map: map,
            zIndex: 1,
          });
          routeMarkers[routeType][`tricMarker_${i}`] = tricMarker;
        }
        walkMarkerAdded = false;
        jeepMarkerAdded = false;
        lastLinkIndex = i;
      } else {
        walkMarkerAdded = false;
        jeepMarkerAdded = false;
        tricMarkerAdded = false;
      }

      let sourceNode = routeMarkers[routeType][sourceID];
      let targetNode = routeMarkers[routeType][targetID];
      let line = new google.maps.Polyline({
        path: [
          {
            lat: sourceNode.getCenter().lat(),
            lng: sourceNode.getCenter().lng(),
          },
          {
            lat: targetNode.getCenter().lat(),
            lng: targetNode.getCenter().lng(),
          },
        ],
        strokeWeight: strokeWeight,
        strokeOpacity: strokeOpacity,
        strokeColor: lineColor,
        map: map,
        zIndex: 0,
      });

      google.maps.event.addListener(line, "mouseover", function () {
        // Add opacity to all related lines when mouseover
        setOpacityToRelatedLines(routePolylines[routeType], 0.1); // Adjust opacity as needed
      });

      google.maps.event.addListener(line, "mouseout", function () {
        // Revert to the original opacity when mouseout
        setOpacityToRelatedLines(routePolylines[routeType], 1); // Adjust opacity as needed
      });

      routePolylines[routeType].push(line);
    }
  }

  if (lastLinkIndex >= -1) {
    let targetID = path[path.length - 1];
    let targetNode = routeMarkers[routeType][targetID];
    let flagMarker = new google.maps.Marker({
      position: targetNode.getCenter(),
      icon: {
        url: "images/flag.png",
        scaledSize: new google.maps.Size(40, 40),
      },
      map: map,
      zIndex: 1,
    });
    routeMarkers[routeType][`flagMarker_${lastLinkIndex}`] = flagMarker;
  }
}

function setOpacityToRelatedLines(lines, opacity) {
  lines.forEach((line) => {
    line.setOptions({ strokeOpacity: opacity });
  });
}

function toggleRoute(routeType) {
  [
    "cheapest",
    "shortest",
    "simplest",
    "percentile75th",
    "percentile50th",
    "percentile25th",
  ].forEach((type) => {
    const isCurrentRoute = type === routeType;
    Object.values(routeMarkers[type]).forEach((marker) => {
      marker.setMap(isCurrentRoute ? map : null);
    });
    routePolylines[type].forEach((polyline) => {
      polyline.setMap(isCurrentRoute ? map : null);
    });
  });

  let container = document.getElementById("instructionsContainer");
  container.innerHTML = "";

  routeInstructions[routeType].forEach((instructionElement) => {
    container.appendChild(instructionElement);
  });
}




async function geneticAlgorithm() {
  console.log("Source Coordinates:", sourceCoordinates);
  console.log("Dest Coordinates:", destCoordinates);

  let population = await initPopulation(populationSize);
  console.log("Initial population received:", population);

  let results = {
    cheapest: {},
    shortest: {},
    simplest: {},
    percentile75th: {},
    percentile50th: {},
    percentile25th: {},
  };

  for (let i = 0; i < generationCount; i++) {
    const workerPromises = [];
    population.forEach((individual) => {
      const worker = new Worker("./scripts/worker2.js");
      worker.postMessage({
        individual,
        sourceCoordinates,
        destCoordinates,
      });

      const promise = new Promise((resolve, reject) => {
        worker.addEventListener("message", (event) => {
          console.log("Received better individual:", event.data);
          resolve(event.data);
          worker.terminate();
        });
        worker.addEventListener("error", (error) => {
          console.error(error);
          reject(error);
        });
      });
      workerPromises.push(promise);
    });

    await Promise.all(workerPromises)
      .then((newIndividuals) => {
        console.log("New Population:", newIndividuals);
        newIndividuals.sort((a, b) => evaluate(a) - evaluate(b));
        population = newIndividuals.slice(0, populationSize);

        ["cheapest", "shortest", "simplest"].forEach((key, idx) => {
          results[key] = population.reduce(
            (acc, curr) =>
              evaluate(curr, idx) < evaluate(acc, idx) ? curr : acc,
            population[0]
          );
          results[key].details = extractCostDistance(
            results[key].path,
            results[key].links
          );
        });

        ["percentile75th", "percentile50th", "percentile25th"].forEach(
          (key, idx) => {
            results[key] =
              population[Math.floor(population.length * (0.25 * (idx + 1)))];
            results[key].details = extractCostDistance(
              results[key].path,
              results[key].links
            );
          }
        );
      })
      .catch((error) => {
        console.error("Error in worker promises:", error);
      });
  }

  return results;
}

function initPopulation(size) {
  console.log("initPopulation");
  let resolveInitialPopulation;
  const initialPopulationPromise = new Promise((resolve) => {
    resolveInitialPopulation = resolve;
  });
  const routeNodesArray = [];
  let closestNodesFromEachRoute = [];

  let nodes = [...jsonData.nodes];
  let links = [...jsonData.links];
  let allRoutes = extractAllRoutes(nodes);
  let counter = 0;

  allRoutes.forEach((route) => {
    const routeNodes = nodes.filter((node) => node.id.startsWith(route));

    let closestNode = closestNodeToPoint(
      (sourceCoordinates.lat, sourceCoordinates.lng),
      routeNodes
    );

    if (!closestNode) return;

    closestNode.distance = Math.sqrt(
      Math.pow(sourceCoordinates.lat - closestNode.x, 2) +
        Math.pow(sourceCoordinates.lng - closestNode.y, 2)
    );

    if (closestNode.distance <= 0.02) {
      closestNodesFromEachRoute[counter] = closestNode;
      closestNodesFromEachRoute[counter].route = route;
      counter += 1;
    }
  });

  closestNodesFromEachRoute.sort((a, b) => a.distance - b.distance);

  if (closestNodesFromEachRoute.length === 0) {
    return [];
  }

  const maxNumRoutes = Math.min(4, closestNodesFromEachRoute.length);
  const minNumRoutes = Math.max(1, maxNumRoutes); // Ensure at least one route
  const fourClosestRoutes = closestNodesFromEachRoute.slice(0, minNumRoutes);

  const workers = [];
  const initialPopulation = [];

  const individualsPerRoute = Math.floor(size / minNumRoutes);

  for (let i = 0; i < size; i++) {
    const worker = new Worker("./scripts/worker.js");
    worker.postMessage({
      index: i,
      individualsPerRoute,
      minNumRoutes,
      fourClosestRoutes,
      sourceCoordinates,
      destCoordinates,
      nodes,
      links,
      size,
    });
    const promise = new Promise((resolve, reject) => {
      worker.addEventListener("message", (event) => {
        initialPopulation.push(event.data);
        console.log("Received individual:", event.data);
        resolve();
        worker.terminate();
      });
      worker.addEventListener("error", (error) => {
        console.error(error);
        reject(error);
      });
    });
    workers.push(promise);
  }
  Promise.all(workers).then(() => {
    resolveInitialPopulation(initialPopulation);
  });
  return initialPopulationPromise;
}

function evaluate(individual, type) {
  const { path, links } = individual;
  const { totalCost, totalDistance, commutes } = extractCostDistance(
    path,
    links
  );

  if (type === 0) return totalCost;
  if (type === 1) return totalDistance;
  if (type === 2) return commutes;
}

async function runGeneticAlgorithm() {

  console.log("S", sourceCoordinates);
  console.log("D", destCoordinates);
    
  if (!sourceCoordinates || !destCoordinates) {
    alert('Please enter both starting point and destination.');
    console.log("source/destination coordinates are null");
    return;
  }
  toggleLoading();
  removeAllMarkers();
  const routesContainer = document.getElementById("routes-container");
  routesContainer.innerHTML = "";

  setTimeout(async () => {
    try {
      const response = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceCoordinates, destCoordinates }),
      });
      const data = await response.json();

      if (data.exists && data.algResults) {
        console.log("directions exist");
        algResults = data.algResults;
        console.log("algResults");
        console.log(algResults);
      } else {
        console.log("directions doesn't exist");
        algResults = await geneticAlgorithm();
        console.log("algResults");
        console.log(algResults);
        // Save the new result to the database
        await fetch("/api/save-result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceCoordinates,
            destCoordinates,
            algResults,
          }),
        });
      }

      const routeTypes = [
        "cheapest",
        "shortest",
        "simplest",
        "percentile75th",
        "percentile50th",
        "percentile25th",
      ];
      let commutesText = document.getElementById("commutesText");
      commutesText.style.display = "block";
      const bounds = new google.maps.LatLngBounds(); // Initialize bounds to include the entire route
      for (const routeType of routeTypes) {
        const routeData = algResults[routeType];
        await plotRouteOnMap(
          routeData.path,
          routeData.nodes,
          routeData.links,
          routeType
        );
        routeInstructions[routeType] = generateRouteInstructions(routeData);

        if (routeData.path && routeData.nodes) {
          routeData.path.forEach((nodeId) => {
            const node = routeData.nodes.find((n) => n.id === nodeId);
            if (node) {
              const latLng = new google.maps.LatLng(node.x, node.y);
              bounds.extend(latLng); // Extend the bounds to include this point
            }
          });
        }
      }

      // Set the map's bounds to fit the entire route
      map.fitBounds(bounds);

      // Center the map on the user's current location (sourceCoordinates)
      map.setCenter(sourceCoordinates);

      routeTypes.forEach((routeType) => {
        const routeDiv = document.createElement("div");
        routeDiv.className =
          "get-direction flex-grow-equal clickable button-off margin-bottom-10";
        routeDiv.innerHTML = routeType.includes("percentile")
          ? routeType === "percentile25th"
            ? "Alt 3"
            : routeType === "percentile50th"
            ? "Alt 2"
            : routeType === "percentile75th"
            ? "Alt 1"
            : ""
          : routeType === "shortest"
          ? "Fastest"
          : routeType.charAt(0).toUpperCase() + routeType.slice(1);

        routeDiv.addEventListener("click", () => {
          Array.from(routesContainer.childNodes).forEach((child) => {
            child.className =
              "get-direction flex-grow-equal clickable button-off margin-bottom-10";
          });
          routeDiv.className =
            "get-direction flex-grow-equal clickable button-on margin-bottom-10";
          updateRouteDetails(routeType);
          toggleRoute(routeType);
        });
        routesContainer.appendChild(routeDiv);
      });

      // Trigger click on "cheapest"
      routesContainer.firstChild.className =
        "get-direction flex-grow-equal clickable button-on margin-bottom-10";
      routesContainer.firstChild.click();
      toggleLoading();
    } catch (e) {
      console.error(e); // For debugging
      alert('Oops! Cannot find path. Please generate another route.');
      toggleLoading();
    }
  }, 2000);
}

async function regenerateAlgo() {
  closeModal()
  try {
    // Show loading overlay
    toggleLoading(true);

    // Check if directions exist in the database
    const checkResponse = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceCoordinates, destCoordinates }),
    });

    const checkData = await checkResponse.json();

    if (checkData.exists) {
      // Directions exist, delete them
      await fetch("/api/delete-directions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceCoordinates,
          destCoordinates,
        }),
      });
    }

    // Call the genetic algorithm function
    await runGeneticAlgorithm();

    // Hide loading overlay after the genetic algorithm is completed
    toggleLoading(false);
  } catch (error) {
    console.error(error);
    // Hide loading overlay in case of an error
    toggleLoading(false);
    // Handle error (e.g., display an error message)
  }
}

function checkSourceAndDest() {
  var sourceValue = document.getElementById('source').value;
    var destValue = document.getElementById('dest').value;

    // Check if source and destination are the same
    if (sourceValue === destValue) {
      alert("Start Location and Destination cannot be the same");
    } else {
      runGeneticAlgorithm();
    }
}

function confirmRegenerate() {
  var userConfirmed = confirm("Are you sure you want to regenerate route? This might take a while.");

  if (userConfirmed) {
    regenerateAlgo();
  }
}


function updateRouteDetails(type) {
  if (
    [
      "cheapest",
      "shortest",
      "simplest",
      "percentile75th",
      "percentile50th",
      "percentile25th",
    ].includes(type)
  ) {
    const details = algResults[type].details;

    // Debugging: make sure details exists
    if (!details) {
      console.error(`Details for ${type} are not available.`);
      return;
    }

    document.getElementById("totalCost").innerText = `P${Math.ceil(
      details.totalCost
    )}`;
    document.getElementById(
      "totalDistance"
    ).innerText = `${details.totalDistance.toFixed(1)}km`;
    const totalTime = Math.round((details.totalDistance / 30) * 60);
    document.getElementById("totalTime").innerText = `${totalTime} minutes`;
    document.getElementById("routeDetailsContainer").style.display = "flex";
  }
}

document.addEventListener("DOMContentLoaded", function() {
  fetchBarangays(); // Initialize barangays
});

function updateSourceOptions() {
  var brgySelect = document.getElementById('brgySource');
  var placeSelect = document.getElementById('placeSource');
  var selectedBrgy = brgySelect.value;

  // Clear existing options
  placeSelect.innerHTML = '<option value="" disabled selected>Select a Source Place</option>';

  // Fetch data based on the selected barangay
  fetchData('places.json')
      .then(data => {
          console.log('Fetched data:', data);

          // Filter places based on the selected barangay
          const filteredPlaces = data.filter(place => place.brgy === selectedBrgy);

          console.log("Selected Brgy for Source", selectedBrgy);
          console.log("Filtered Places for Source", filteredPlaces);

          // Check if there are any filtered places
          if (filteredPlaces.length > 0) {
              // Add new options based on the fetched data
              filteredPlaces.forEach(item => {
                  console.log("Place selected for Source:", item.place, item.coordinates);
                  addOption(placeSelect, item.place, selectedBrgy, item.coordinates);
              });
          } else {
              console.log("No places found for the selected source barangay.");
          }
      })
      .catch(error => {
          console.error('Error fetching data:', error);
      });
}

function updateDestOptions() {
  var brgySelect = document.getElementById('brgyDest');
  var placeSelect = document.getElementById('placeDest');
  var selectedBrgy = brgySelect.value;

  // Clear existing options
  placeSelect.innerHTML = '<option value="" disabled selected>Select a Destination Place</option>';

  // Fetch data based on the selected barangay
  fetchData('places.json')
      .then(data => {
          console.log('Fetched data:', data);

          // Filter places based on the selected barangay
          const filteredPlaces = data.filter(place => place.brgy === selectedBrgy);

          console.log("Selected Brgy for Destination", selectedBrgy);
          console.log("Filtered Places for Destination", filteredPlaces);

          // Check if there are any filtered places
          if (filteredPlaces.length > 0) {
              // Add new options based on the fetched data
              filteredPlaces.forEach(item => {
                  console.log("Place selected for Destination:", item.place, item.coordinates);
                  addOption(placeSelect, item.place, selectedBrgy, item.coordinates);
              });
          } else {
              console.log("No places found for the selected destination barangay.");
          }
      })
      .catch(error => {
          console.error('Error fetching data:', error);
      });
}

function addOption(selectElement, text, barangay, coordinates) {
  var option = document.createElement('option');
  console.log("Option Text", text);

  // Convert the coordinates object to a string (stringify)
  const coordinatesString = JSON.stringify(coordinates);

  option.text = text;
  option.value = coordinatesString;
  option.setAttribute('data-barangay', barangay); // Set a data attribute for barangay
  selectElement.add(option);
  console.log("Option coordinates", coordinatesString, option.value);
}

function fetchBarangays() {
  fetchData('barangays.json')
      .then(data => {
          console.log('Fetched barangays:', data);

          var brgySourceSelect = document.getElementById('brgySource');
          var brgyDestSelect = document.getElementById('brgyDest');

          // Add options for source barangay
          data.forEach(item => {
              addOption(brgySourceSelect, item.brgy, item.brgy, {});
          });

          // Add options for destination barangay
          data.forEach(item => {
              addOption(brgyDestSelect, item.brgy, item.brgy, {});
          });

          // Update source and destination options based on the default source barangay
          updateSourceOptions();
          updateDestOptions();
      })
      .catch(error => {
          console.error('Error fetching barangay data:', error);
      });
}

function fetchData(fileName) {
  // Simulate fetching data from an API
  return fetch(fileName)
      .then(response => response.json())
      .then(data => data)
      .catch(error => {
          throw new Error('Error fetching data: ' + error);
      });
}

function checkSourceAndDest2() {
  var sourceValue = document.getElementById('placeSource').value;
  var destValue = document.getElementById('placeDest').value;
  
  console.log("Source Value", sourceValue);
  console.log("Dest Value", destValue);

  // Example of parsing the coordinates back to an object
  // var selectedOption = placeSourceSelect.options[placeSourceSelect.selectedIndex];
  sourceCoordinates = JSON.parse(sourceValue);
  console.log("Source Parsed Coordinates", sourceCoordinates);
  destCoordinates = JSON.parse(destValue);
  console.log("Dest Parsed Coordinates", destCoordinates);

  // Check if source and destination are the same
  if (sourceValue == destValue) {
    alert("Start Location and Destination cannot be the same");
  } else {
    console.log("Run genetic")
    runGeneticAlgorithm();
  }
}