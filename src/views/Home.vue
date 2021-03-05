<template>
  <div class="home">
    <button @click="connect">1. getRouterRtpCapabilities</button><br />

    <div>Status Local Video: {{ status }}</div>
    Local Video
    <video id="local_video" autoplay playsinline controls="false"></video><br />
    <button @click="publish">2. publish</button><br /><br />
    <div>Status Remote Video: {{ status2 }}</div>
    Remote Video
    <video id="remote_video" autoplay playsinline controls="false"></video
    ><br />
    <button @click="subscribe">1. subcribe</button><br /><br />
    <br />
  </div>
</template>

<script>
const socketPromise = require("@/lib/socket.io-promise").promise;

// @ is an alias to /src
const mediasoup = require("mediasoup-client");
export default {
  name: "Home",
  components: {},
  methods: {
    async connect() {
      this.$io.request = socketPromise(this.$io);
      const data = await this.$io.request("getRouterRtpCapabilities");
      console.log(data);
      await this.loadDevice(data);
      // this.$io.emit("getRouterRtpCapabilities");
    },
    async publish() {
      const data = await this.$io.request("createProducerTransport", {
        forceTcp: false,
        rtpCapabilities: this.device.rtpCapabilities,
      });
      console.log(data);
      if (data.error) {
        console.error(data.error);
        return;
      }

      console.log("device:", this.device);
      const transport = this.device.createSendTransport(data);
      transport.on("connect", async ({ dtlsParameters }, callback, errback) => {
        try {
          await this.$io.request("connectProducerTransport", {
            transportId: transport.id,
            dtlsParameters: dtlsParameters,
          });
          console.log("transport connect");
          // Tell the transport that parameters were transmitted.
          callback();
        } catch {
          // Tell the transport that something was wrong.
          console.log("error transport connect");
          errback();
        }

        // .then(callback)
        // .catch(errback);
      });

      transport.on("produce", async (parameters, callback, errback) => {
        try {
          const { id } = await this.$io.request("produce", {
            transportId: transport.id,
            kind: parameters.kind,
            rtpParameters: parameters.rtpParameters,
            appData: parameters.appData,
          });
          console.log("id", id);
          callback({ id });
        } catch (err) {
          console.log("error transport produce");
          errback(err);
        }
      });

      let stream;
      // let producer;
      transport.on("connectionstatechange", (state) => {
        switch (state) {
          case "connecting":
            this.status = "publishing...";
            break;

          case "connected":
            document.querySelector("#local_video").srcObject = stream;
            // $txtPublish.innerHTML = "published";
            this.status = "published";
            break;

          case "failed":
            transport.close();
            this.status = "failed";
            break;

          default:
            break;
        }
      });

      try {
        stream = await this.getUserMedia(transport);
        console.log("stream", stream);
        const track = stream.getVideoTracks()[0];
        const params = { track };
        // if ($chkSimulcast.checked) {
        //   params.encodings = [
        //     { maxBitrate: 100000 },
        //     { maxBitrate: 300000 },
        //     { maxBitrate: 900000 },
        //   ];
        //   params.codecOptions = {
        //     videoGoogleStartBitrate: 1000,
        //   };
        // }
        this.producer = await transport.produce(params);
        console.log("producer", this.producer);
        // console.log
      } catch (err) {
        console.log("failed");
      }
    },
    async getUserMedia(transport) {
      console.log("transport", transport);
      // alert(typeof this.device);
      if (!this.device.canProduce("video")) {
        console.error("cannot produce video");
        return;
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          // audio: true,
        });
      } catch (err) {
        console.error("getUserMedia() failed:", err.message);
        throw err;
      }
      return stream;
    },
    async loadDevice(routerRtpCapabilities) {
      try {
        this.device = new mediasoup.Device();
      } catch (error) {
        if (error.name === "UnsupportedError") {
          console.error("browser not supported");
        }
      }
      await this.device.load({ routerRtpCapabilities });
    },
    // untuk subcriber or penerima
    async subscribe() {
      const data = await this.$io.request("createConsumerTransport", {
        forceTcp: false,
      });
      if (data.error) {
        console.error(data.error);
        return;
      }
      console.log(data);

      let stream;
      const transport = this.device.createRecvTransport(data);
      console.log("consumer transport", transport);
      transport.on("connect", async ({ dtlsParameters }, callback, errback) => {
        try {
          await this.$io.request("connectConsumerTransport", {
            transportId: transport.id,
            dtlsParameters,
          });

          callback();
        } catch (error) {
          errback(error);
        }
      });

      transport.on("connectionstatechange", async (state) => {
        switch (state) {
          case "connecting":
            this.status2 = "subscribing...";
            break;

          case "connected":
            document.querySelector("#remote_video").srcObject = await stream;
            await this.$io.request("resume");
            this.status2 = "subscribed";
            break;

          case "failed":
            transport.close();
            this.status2 = "failed";
            break;

          default:
            break;
        }
      });

      stream = this.consume(transport);
    },
    async consume(transport) {
      const { rtpCapabilities } = this.device;
      const data = await this.$io.request("consume", { rtpCapabilities });
      console.log("consume", data);
      const { producerId, id, kind, rtpParameters } = data;

      let codecOptions = {};
      const consumer = await transport.consume({
        id,
        producerId,
        kind,
        rtpParameters,
        codecOptions,
      });
      const stream = new MediaStream();
      stream.addTrack(consumer.track);
      return stream;
    },
  },

  data() {
    return {
      device: undefined,
      status: null,
      status2: null,
      producer: undefined,
    };
  },
  mounted() {
    // navigator.mediaDevices
    //   .getUserMedia({ video: true, audio: true })
    //   .then((stream) => {
    //     console.log(stream);
    //   })
    //   .catch((err) => {
    //     console.log(err);
    //   });
    // Create a device (use browser auto-detection).
    // const device = new Device();
    // const routerRtpCapabilities = mySignaling.request('getRouterCapabilities');
    // console.log(device.canProduce("video"));
  },
};
</script>
