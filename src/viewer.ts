import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { PointCloudOctree, Potree, PointShape, PointColorType } from "@pnext/three-loader";

export class Viewer {
  /**
   * The element where we will insert our canvas.
   */
  private targetEl: HTMLElement | undefined;
  /**
   * The ThreeJS renderer used to render the scene.
   */
  private renderer = new WebGLRenderer();
  /**
   * Our scene which will contain the point cloud.
   */
  private scene = new Scene();
  /**
   * The camera used to view the scene.
   */
  private camera = new PerspectiveCamera(45, NaN, 0.1, 1000);
  /**
   * Controls which update the position of the camera.
   */
  // private cameraControls = new CameraControls(this.camera);
  private orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
  /**
   * Out potree instance which handles updating point clouds, keeps track of loaded nodes, etc.
   */
  private potree = new Potree();
  /**
   * Array of point clouds which are in the scene and need to be updated.
   */
  private pointClouds: PointCloudOctree[] = [];
  /**
   * The time (milliseconds) when `loop()` was last called.
   */
  private prevTime: number | undefined;
  /**
   * requestAnimationFrame handle we can use to cancel the viewer loop.
   */
  private reqAnimationFrameHandle: number | undefined;

  /**
   * Initializes the viewer into the specified element.
   * Initializes orbitControls.
   * Adds EventListeners.
   *
   * @param targetEl
   *    The element into which we should add the canvas where we will render the scene.
   */
  initialize(targetEl: HTMLElement): void {
    if (this.targetEl || !targetEl) {
      return;
    }

    this.targetEl = targetEl;
    targetEl.appendChild(this.renderer.domElement);

    this.orbitControls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    this.orbitControls.dampingFactor = 0.05;

    this.orbitControls.screenSpacePanning = false;

    this.orbitControls.minDistance = 10;
    this.orbitControls.maxDistance = 50;

    this.orbitControls.maxPolarAngle = Math.PI / 2;
    this.resize();

    window.addEventListener("resize", this.resize);

    const opacityEl = targetEl.querySelector("input[name=opacity]");
    opacityEl.addEventListener("input", this.changePointsOpacity);

    const sizeEl = targetEl.querySelector("input[name=size]");
    sizeEl.addEventListener("input", this.changePointsSize);

    const selectLayerEl = targetEl.querySelector("select[name=layers]");
    selectLayerEl.addEventListener("change", this.changeLayer);

    const selectEl = targetEl.querySelector("select");
    selectEl.addEventListener("change", this.configPointsShape);

    requestAnimationFrame(this.loop);
  }

  /**
   * Performs any cleanup necessary to destroy/remove the viewer from the page.
   */
  destroy(): void {
    this.targetEl.removeChild(this.renderer.domElement);
    // Removing all child nodes event listeners, ref https://stackoverflow.com/questions/9251837/how-to-remove-all-listeners-in-an-element
    const targetElClone = this.targetEl.cloneNode(true);
    this.targetEl.parentNode.replaceChild(targetElClone, this.targetEl);
    this.targetEl = undefined;
    this.orbitControls = undefined;
    window.removeEventListener("resize", this.resize);

    // TODO: clean point clouds or other objects added to the scene.
    this.pointClouds = [];

    if (this.reqAnimationFrameHandle !== undefined) {
      cancelAnimationFrame(this.reqAnimationFrameHandle);
    }
  }

  /**
   * Loads a point cloud into the viewer and returns it.
   *
   * @param fileName
   *    The name of the point cloud which is to be loaded.
   * @param baseUrl
   *    The url where the point cloud is located and from where we should load the octree nodes.
   */
  load(fileName: string, baseUrl: string): Promise<PointCloudOctree> {
    return this.potree
      .loadPointCloud(
        // The file name of the point cloud which is to be loaded.
        fileName,
        // Given the relative URL of a file, should return a full URL.
        (url: any) => `${baseUrl}${url}`
      )
      .then((pco: PointCloudOctree) => {

        // Add the point clouds to the two layer of the scene.
        // for ( let layer = 0; layer < 2; layer ++ ){
          // Add the point cloud to the scene and to our list of
          // point clouds. We will pass this list of point clouds to
          // potree to tell it to update them.

          // Color points based on elavation for layer 1.
          // if (layer == 1){
          //   pco.material.pointColorType = PointColorType.RGB_HEIGHT;
          // }
          // else{
          // }
          // pco.layers.set(layer);
          // }
          
          pco.material.pointColorType = PointColorType.RGB;
          this.scene.add(pco);
          this.pointClouds.push(pco);
        // }
      });
  }

  /**
   * Updates the point clouds, cameras or any other objects which are in the scene.
   *
   * @param dt
   *    The time, in milliseconds, since the last update.
   */
  update(dt: number): void {
    // Alternatively, you could use Three's OrbitControls or any other
    // camera control system.
    this.orbitControls.update();
    // This is where most of the potree magic happens. It updates the
    // visiblily of the octree nodes based on the camera frustum and it
    // triggers any loads/unloads which are necessary to keep the number
    // of visible points in check.
    this.potree.updatePointClouds(this.pointClouds, this.camera, this.renderer);
  }

  /**
   * Renders the scene into the canvas.
   */
  render(): void {
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * The main loop of the viewer, called at 60FPS, if possible.
   */
  loop = (time: number): void => {
    this.reqAnimationFrameHandle = requestAnimationFrame(this.loop);

    const prevTime = this.prevTime;
    this.prevTime = time;
    if (prevTime === undefined) {
      return;
    }

    this.orbitControls.update();

    this.update(time - prevTime);
    this.render();
  };

  /**
   * Triggered anytime the window gets resized.
   * 
   */
  resize = () => {
    const { width, height } = this.targetEl.getBoundingClientRect();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  /**
   * Triggered anytime point shape option is changed.
   * @param e
   *    HTML event which takes place in the DOM.
   */
   configPointsShape = (e: Event) => {
     // Input value
     let value = e.target.value;
     switch (value) {
       case "Square":{
         this.pointClouds.forEach(p => p.material.shape = PointShape.SQUARE);
         break;
       }
       case "Circle":{
        this.pointClouds.forEach(p => p.material.shape = PointShape.CIRCLE);
        break;
      }
      // This option is disabled by default as it raises a WebGL error.
       case "Paraboloid":{
        this.pointClouds.forEach(p => p.material.shape = PointShape.PARABOLOID);
        break;
      }
     }
  };

  /**
   * Triggered anytime a different layer gets selected.
   * @param e
   *    HTML event which takes place in the DOM.
   * 
   */
     changeLayer = (e: Event) => {
      let value = e.target.value;
      switch (value) {
        case "1":{
          // this.camera.layers.enable(0);
          // this.camera.layers.disable(1);
          this.pointClouds.forEach(p => p.material.pointColorType = PointColorType.RGB);
          break;
        }
        case "2":{
          // this.camera.layers.enable(1);
          // this.camera.layers.disable(0);
          this.pointClouds.forEach(p => p.material.pointColorType = PointColorType.RGB_HEIGHT);
          break;
       }
      }
   };

  /**
   * Triggered anytime the points opacity property gets modified.
   * @param e
   *    HTML event which takes place in the DOM.
   * 
   */
      changePointsOpacity = (e: Event) => {
        // Input value
        let value = e.target.value;
        if (!isNaN(Number(value)) && value != ""){
          this.pointClouds.forEach(p => p.material.opacity = value);
        }
      };

  /**
   * Triggered anytime the points size property get modified.
   * @param e
   *    HTML event which takes place in the DOM.
   * 
   */
    changePointsSize = (e: Event) => {
      // Input value
      let value = e.target.value;
      if (! isNaN(Number(value)) && value != ""){
        this.pointClouds.forEach(p => p.material.size = value);
      }
};
}
