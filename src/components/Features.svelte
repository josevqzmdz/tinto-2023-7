<script>
</script>

<section id="features" class="features">
    <div class="content">
        <header class="header">
            <p class="header-text">Features</p>
        </header>

        <div class="features-blocks">
            <div class="row">
                <div class="feature">
                    <div class="image">
                        <img src="/static/feature1.png" alt="" srcset="" />
                    </div>
                    <div class="description">
                        <div class="description-header">Feature</div>
                        <div class="description-body">
                            Pellentesque quis orci a enim porttitor condimentum.
                            Nullam ut euismod justo. Duis sed quam sodales,
                            feugiat dui eget, condimentum orci. Pellentesque et
                            laoreet mauris, sed tristique dui. Pellentesque
                            tempus libero ac massa suscipit, mollis dapibus
                            velit egestas. Quisque a fringilla felis, ornare
                            porttitor leo. Ut et orci lectus. Praesent non felis
                            ac nisl rutrum porta.
                        </div>
                    </div>
                </div>
                <div class="feature">
                    <div class="image">
                        <img src="/static/feature2.png" alt="" srcset="" />
                    </div>
                    <div class="description">
                        <div class="description-header">Feature</div>
                        <div class="description-body">
                            Pellentesque quis orci a enim porttitor condimentum.
                            Nullam ut euismod justo. Duis sed quam sodales,
                            feugiat dui eget, condimentum orci. Pellentesque et
                            laoreet mauris, sed tristique dui. Pellentesque
                            tempus libero ac massa suscipit, mollis dapibus
                            velit egestas. Quisque a fringilla felis, ornare
                            porttitor leo. Ut et orci lectus. Praesent non felis
                            ac nisl rutrum porta.
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="feature">
                    <div class="image">
                        <img src="/static/feature3.png" alt="" srcset="" />
                    </div>
                    <div class="description">
                        <div class="description-header">Feature</div>
                        <div class="description-body">
                            Pellentesque quis orci a enim porttitor condimentum.
                            Nullam ut euismod justo. Duis sed quam sodales,
                            feugiat dui eget, condimentum orci. Pellentesque et
                            laoreet mauris, sed tristique dui. Pellentesque
                            tempus libero ac massa suscipit, mollis dapibus
                            velit egestas. Quisque a fringilla felis, ornare
                            porttitor leo. Ut et orci lectus. Praesent non felis
                            ac nisl rutrum porta.
                        </div>
                    </div>
                </div>
                <div class="feature">
                    <div class="image">
                        <img src="/static/feature1.png" alt="" srcset="" />
                    </div>
                    <div class="description">
                        <div class="description-header">Feature</div>
                        <div class="description-body">
                            Pellentesque quis orci a enim porttitor condimentum.
                            Nullam ut euismod justo. Duis sed quam sodales,
                            feugiat dui eget, condimentum orci. Pellentesque et
                            laoreet mauris, sed tristique dui. Pellentesque
                            tempus libero ac massa suscipit, mollis dapibus
                            velit egestas. Quisque a fringilla felis, ornare
                            porttitor leo. Ut et orci lectus. Praesent non felis
                            ac nisl rutrum porta.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>

<style>
    section {
        height: 100vh;
        background: url("/static/background-tiled.png");
        background-repeat: repeat;
        background-size: 250px;
        box-shadow: inset 0px 0px 50px 50px rgba(0, 0, 0, 0.5);
    }

    .content {
        background-color: rgba(255, 255, 255, 0.7);
    }

    header {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        height: 10vh;
    }

    header > p.header-text {
        color: black;
        font-size: 48px;
        margin: 0;
    }
    .features-blocks {
        height: 90vh;
        padding: 0 10%;
    }
    .features-blocks > .row {
        height: 45vh;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
    }

    .features-blocks > .row > .feature {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        width: 50%;
        height: 100%;
    }

    .image {
        width: 50%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .image > img {
        height: auto;
        width: 150px;
    }

    .description-header {
        font-size: 24px;
        font-weight: bold;
    }
</style>
