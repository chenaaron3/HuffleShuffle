import Head from 'next/head';
import { useState } from 'react';
import { AnimationDemo } from '~/components/AnimationDemo';

export default function AnimationDemoPage() {
    return (
        <>
            <Head>
                <title>Animation Demo - HuffleShuffle</title>
                <meta name="description" content="Demo page for poker game animations" />
            </Head>
            <AnimationDemo />
        </>
    );
}
