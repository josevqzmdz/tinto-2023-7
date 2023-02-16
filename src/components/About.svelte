<script></script>

<section id="about" class="about">
    <div class="content">
        <header class="header">
            <p class="header-text">About Us</p>
        </header>
        <div class="about-text text-center">
            <div class="background">
                <p class="lead mb-4">
                    Desde el año 1992, hemos atendido las necesidades de
                    limpieza de ropa de la ciudad de los reyes, michoacan.
                </p>
                <p class="lead mb-4">
                    Atendiendo siempre cordialmente al cliente y entregando el
                    mejor trabajo posible de tintoreria y lavanderia posible
                </p>
            </div>
        </div>
        <div class="container text-center description-blocks">
            <div class="row">
                <div class="col">
                    Pellentesque quis orci a enim porttitor condimentum. Nullam
                    ut euismod justo. Duis sed quam sodales, feugiat dui eget,
                    condimentum orci. Pellentesque et laoreet mauris, sed
                    tristique dui. Pellentesque tempus libero ac massa suscipit,
                    mollis dapibus velit egestas. Quisque a fringilla felis,
                    ornare porttitor leo. Ut et orci lectus. Praesent non felis
                    ac nisl rutrum porta.
                </div>
                <div class="col">
                    Pellentesque quis orci a enim porttitor condimentum. Nullam
                    ut euismod justo. Duis sed quam sodales, feugiat dui eget,
                    condimentum orci. Pellentesque et laoreet mauris, sed
                    tristique dui. Pellentesque tempus libero ac massa suscipit,
                    mollis dapibus velit egestas. Quisque a fringilla felis,
                    ornare porttitor leo. Ut et orci lectus. Praesent non felis
                    ac nisl rutrum porta.
                </div>
                <div class="col">
                    Pellentesque quis orci a enim porttitor condimentum. Nullam
                    ut euismod justo. Duis sed quam sodales, feugiat dui eget,
                    condimentum orci. Pellentesque et laoreet mauris, sed
                    tristique dui. Pellentesque tempus libero ac massa suscipit,
                    mollis dapibus velit egestas. Quisque a fringilla felis,
                    ornare porttitor leo. Ut et orci lectus. Praesent non felis
                    ac nisl rutrum porta.
                </div>
            </div>
        </div>
    </div>
</section>

<style>
    section {
        height: 100vh;
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

    section > .content > .about-text.text-center {
        box-shadow: inset 0px 0px 20px 20px rgba(0, 0, 0, 0.9);
        background: url("/static/background-tiled.png");
        background-repeat: repeat;
        background-size: 250px;
        height: 30vh;
        animation: scrolling 60s linear infinite;
    }

    section > .content > .about-text.text-center > .background {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        background-color: #f0f0f094;
        width: 100%;
        height: 100%;
    }

    section > .content > .about-text.text-center > .background > p {
        font-size: 16px;
        color: black;
        font-weight: bold;
    }

    @keyframes scrolling {
        from {
            background-position: 0 0;
        }
        to {
            background-position: 50% 50%;
        }
    }

    .description-blocks {
        height: 60vh;
        display: flex;
        align-items: center;
    }
</style>
