import { Viewer } from "./viewer";

const viewer = new Viewer();
viewer.initialize(document.getElementById("target"));

viewer
  .load(
    "cloud.js",
    "https://cdn.rawgit.com/potree/potree/develop/pointclouds/lion_takanawa/"
  )
  .then((pco) => {
  })
  .catch((err) => console.error(err));
