"use strict";
// MobileSAM inference, off the main thread (js/segment.js owns the Cache-API download + progress UI and
// hands this worker already-fetched buffers/blob URLs, so nothing here touches the network itself). One
// encode per image (kept in `embeddings` until the next one arrives), many decodes per encode -- the whole
// point of the split encoder/decoder export, see js/segment.js's header for the measured timings.
let session = { enc: null, dec: null };
let embeddings = null;

self.onmessage = async e => {
  const { id, type } = e.data;
  try {
    if (type === "init") {
      self.importScripts(e.data.ortUrl);              // a blob: URL of ort.min.js's own source -- already cached, never re-fetched
      ort.env.wasm.numThreads = 1;                     // no COOP/COEP on GitHub Pages, so no SharedArrayBuffer -- see js/segment.js's header
      ort.env.wasm.proxy = false;                      // running inside our OWN worker already; ort's multi-thread proxy-worker path is for its own sub-workers, not needed here
      // onnxruntime-web 1.19.2's wasm backend is itself an ES module that ort.min.js dynamically import()s --
      // wasmPaths needs { mjs, wasm } keys (not a filename-keyed map, which was the bug: a filename key like
      // "ort-wasm-simd-threaded.wasm" is silently ignored, so the backend fell through to resolving its own
      // default filename relative to THIS worker's script URL -- js/, not models/ort/ -- and 404'd on every
      // platform; see js/segment.js's SEG_FILES comment). wasmBinary (handing the bytes straight in instead
      // of a wasm: URL) looks like it should also work but throws "Failed to construct 'URL': Invalid URL"
      // deep in the threaded module's own startup on this onnxruntime-web version -- confirmed with a
      // minimal repro 2026-10-10 -- so both files go in as blob: URLs.
      ort.env.wasm.wasmPaths = { mjs: e.data.mjsUrl, wasm: e.data.wasmUrl };
      const [enc, dec] = await Promise.all([
        ort.InferenceSession.create(e.data.encoderBuf, { executionProviders: ["wasm"] }),
        ort.InferenceSession.create(e.data.decoderBuf, { executionProviders: ["wasm"] }),
      ]);
      session = { enc, dec };
      postMessage({ id, ok: true });
    } else if (type === "encode") {
      const { pixels, w, h } = e.data;                 // HWC float32 RGB, 0-255, long edge 1024 (js/segment.js resizes)
      const t0 = performance.now();
      const input = new ort.Tensor("float32", pixels, [h, w, 3]);
      const out = await session.enc.run({ input_image: input });
      embeddings = out.image_embeddings;
      postMessage({ id, ok: true, ms: Math.round(performance.now() - t0) });
    } else if (type === "decode") {
      if (!embeddings) throw new Error("no image encoded yet");
      const { points, labels, rw, rh } = e.data;       // points in the SAME resized pixel space the encoder saw
      const t0 = performance.now();
      const n = labels.length;
      const pointCoords = new ort.Tensor("float32", Float32Array.from(points), [1, n, 2]);
      const pointLabels = new ort.Tensor("float32", Float32Array.from(labels), [1, n]);
      const maskInput = new ort.Tensor("float32", new Float32Array(256 * 256), [1, 1, 256, 256]);
      const hasMask = new ort.Tensor("float32", new Float32Array([0]), [1]);
      const origSize = new ort.Tensor("float32", new Float32Array([rh, rw]), [2]);   // [height, width] -- the decoder's own convention
      const out = await session.dec.run({
        image_embeddings: embeddings, point_coords: pointCoords, point_labels: pointLabels,
        mask_input: maskInput, has_mask_input: hasMask, orig_im_size: origSize,
      });
      const m = out.masks, dims = m.dims, mh = dims[dims.length - 2], mw = dims[dims.length - 1];
      const mask = m.data instanceof Float32Array ? m.data : Float32Array.from(m.data);
      const iou = Array.from(out.iou_predictions.data);
      postMessage({ id, ok: true, ms: Math.round(performance.now() - t0), mask, mw, mh, iou }, [mask.buffer]);
    } else if (type === "reset") {
      embeddings = null;
      postMessage({ id, ok: true });
    } else {
      postMessage({ id, ok: false, error: "unknown message type: " + type });
    }
  } catch (err) {
    postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
