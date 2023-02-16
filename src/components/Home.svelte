<script lang="ts">
    import HomeAnimation from "./HomeAnimation.svelte";
    import HomeAnimation2 from "./HomeAnimation2.svelte";
    import HomeAnimation3 from "./HomeAnimation3.svelte";


</script>

<section id="home" class="home">
    <div
        id="carouselExampleFade"
        class="carousel slide carousel-fade"
        data-bs-interval="5000"
        data-bs-ride="carousel"
    >
        <div class="carousel-inner">
            <div class="carousel-item active">
                <img
                    src="/static/background1.png"
                    class="d-block w-100 opacity-75"
                    alt="..."
                />
                <div class="carousel-caption d-none d-md-block">
                    <div class="carousel-description">
                        <h5>1 slide label</h5>
                        <p>
                            Some representative placeholder content for the 1
                            slide.
                        </p>
                    </div>
                    <div class="carousel-image">
                        <HomeAnimation />
                    </div>
                </div>
            </div>
            <div class="carousel-item">
                <img
                    src="/static/background2.png"
                    class="d-block w-100 opacity-75"
                    alt="..."
                />
                <div class="carousel-caption d-none d-md-block">
                    <div class="carousel-description">
                        <h5>2 slide label</h5>
                        <p>
                            Some representative placeholder content for the 2
                            slide.
                        </p>
                    </div>
                    <div class="carousel-image"><HomeAnimation2 /></div>
                </div>
            </div>
            <div class="carousel-item ">
                <img
                    src="/static/background1.png"
                    class="d-block w-100 opacity-75"
                    alt="..."
                />
                <div class="carousel-caption d-none d-md-block">
                    <div class="carousel-description">
                        <h5>1 slide label</h5>
                        <p>
                            Some representative placeholder content for the 1
                            slide.
                        </p>
                    </div>
                    <div class="carousel-image"><HomeAnimation3 /></div>
                </div>
            </div>
        </div>
    </div>
</section>

<style>
    section,
    div.carousel.slide.carousel-fade,
    div.carousel-inner,
    div.carousel-item,
    img.d-block.w-100.opacity-75 {
        height: 96vh;
    }
    img {
        object-fit: cover;
    }

    .carousel-description {
        display: flex !important;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
    .carousel-image {
        display: flex !important;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
    }
    .carousel-caption {
        display: flex !important;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        top: 0;
        left: 0;
    }
</style>
